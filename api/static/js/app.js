
// ======================================
// ELEMENTOS DA INTERFACE
// ======================================

const formPedido = document.getElementById("form-pedido");
const campoProduto = document.getElementById("produto");
const botaoCadastrar = document.getElementById("btn-cadastrar");
const botaoAtualizar = document.getElementById("btn-atualizar");
const mensagemForm = document.getElementById("mensagem-form");

const listaPedidos = document.getElementById("lista-pedidos");

// ======================================
// FUNÇÕES AUXILIARES
// ======================================

function atualizarIndicador(id, valor) {
    document.getElementById(id).textContent = valor;
}

function mostrarMensagem(texto, sucesso = true) {
    mensagemForm.textContent = texto;
    mensagemForm.style.color = sucesso ? "#16a36a" : "#dc4444";
}

function formatarEstado(estado) {
    const estados = {
        concluido: "Concluído",
        pendente: "Pendente",
        erro: "Erro",
        erro_fila: "Erro na fila"
    };

    return estados[estado] || estado;
}

function classeEstado(estado) {
    const classes = {
        concluido: "status-concluido",
        pendente: "status-pendente",
        erro: "status-erro",
        erro_fila: "status-erro_fila"
    };

    return classes[estado] || "";
}

// ======================================
// CARREGAR PEDIDOS
// ======================================

async function carregarPedidos() {
    try {
        const resposta = await fetch("/pedidos");

        if (!resposta.ok) {
            throw new Error("Não foi possível carregar os pedidos.");
        }

        const pedidos = await resposta.json();

        // Atualiza os indicadores
        const total = pedidos.length;
        const concluidos = pedidos.filter(
            pedido => pedido.estado === "concluido"
        ).length;

        const pendentes = pedidos.filter(
            pedido => pedido.estado === "pendente"
        ).length;

        const erros = pedidos.filter(
            pedido => pedido.estado === "erro" ||
                pedido.estado === "erro_fila"
        ).length;

        atualizarIndicador("total-pedidos", total);
        atualizarIndicador("pedidos-concluidos", concluidos);
        atualizarIndicador("pedidos-pendentes", pendentes);
        atualizarIndicador("pedidos-erro", erros);

        // Atualiza a tabela
        if (pedidos.length === 0) {
            listaPedidos.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-message">
                        Nenhum pedido cadastrado.
                    </td>
                </tr>
            `;
            return;
        }

        listaPedidos.innerHTML = pedidos.map(pedido => `
            <tr>
                <td>#${pedido.id}</td>
                <td>${escaparHTML(pedido.produto)}</td>
                <td>
                    <span class="status-badge ${classeEstado(pedido.estado)}">
                        ${formatarEstado(pedido.estado)}
                    </span>
                </td>
                <td>${escaparHTML(pedido.resultado || "Aguardando processamento")}</td>
            </tr>
        `).join("");

    } catch (erro) {
        console.error("Erro ao carregar pedidos:", erro);

        listaPedidos.innerHTML = `
            <tr>
                <td colspan="4" class="empty-message">
                    Não foi possível carregar os pedidos.
                </td>
            </tr>
        `;
    }
}

// Evita interpretar dados dos pedidos como HTML.
function escaparHTML(valor) {
    const elemento = document.createElement("div");
    elemento.textContent = valor;
    return elemento.innerHTML;
}


// ======================================
// CADASTRO MÚLTIPLO DE PEDIDOS
// ======================================

let produtosPendentes = [];

const botaoAdicionar = document.getElementById("btn-adicionar");
const listaProdutos = document.getElementById("lista-produtos");
const quantidadeProdutos = document.getElementById("quantidade-produtos");

// Adiciona um produto à lista
function adicionarProduto() {
    const produto = campoProduto.value.trim();

    if (!produto) {
        mostrarMensagem("Digite o nome de um produto.", false);
        campoProduto.focus();
        return;
    }

    produtosPendentes.push(produto);

    campoProduto.value = "";
    campoProduto.focus();

    mostrarMensagem("");
    renderizarProdutos();
}

// Exibe os produtos adicionados
function renderizarProdutos() {
    quantidadeProdutos.textContent =
        `${produtosPendentes.length} ${produtosPendentes.length === 1 ? "item" : "itens"}`;

    if (produtosPendentes.length === 0) {
        listaProdutos.innerHTML = `
            <li class="product-empty">
                Nenhum produto adicionado.
            </li>
        `;
        return;
    }

    listaProdutos.innerHTML = produtosPendentes.map((produto, indice) => `
        <li>
            <span>${escaparHTML(produto)}</span>
            <button
                type="button"
                class="remove-product"
                data-indice="${indice}"
                aria-label="Remover produto"
                title="Remover produto"
            >
                ×
            </button>
        </li>
    `).join("");
}

// Adicionar produto pelo botão
botaoAdicionar.addEventListener("click", adicionarProduto);

// Também permite adicionar pressionando Enter
campoProduto.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
        evento.preventDefault();
        adicionarProduto();
    }
});

// Remover produto da lista
listaProdutos.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".remove-product");

    if (!botao) return;

    const indice = Number(botao.dataset.indice);

    produtosPendentes.splice(indice, 1);

    renderizarProdutos();
});

// Enviar todos os pedidos para a API
formPedido.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (produtosPendentes.length === 0) {
        mostrarMensagem("Adicione pelo menos um produto.", false);
        return;
    }

    botaoCadastrar.disabled = true;
    botaoAdicionar.disabled = true;
    botaoCadastrar.textContent = "Enviando pedidos...";

    let enviados = 0;
    let falhas = 0;

    const produtosEnviados = [...produtosPendentes];

    try {
        for (const produto of produtosEnviados) {
            try {
                const resposta = await fetch("/pedidos", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ produto })
                });

                if (!resposta.ok) {
                    throw new Error("Falha ao cadastrar");
                }

                enviados++;

            } catch (erro) {
                console.error(`Erro ao cadastrar ${produto}:`, erro);
                falhas++;
            }
        }

        // Remove da lista apenas os pedidos enviados com sucesso
        if (enviados > 0) {
            produtosPendentes.splice(0, enviados);
        }

        renderizarProdutos();

        if (falhas === 0) {
            mostrarMensagem(`${enviados} pedido(s) cadastrado(s) com sucesso!`);
        } else {
            mostrarMensagem(
                `${enviados} enviado(s) e ${falhas} com falha. Os não enviados continuam na lista.`,
                false
            );
        }

        await carregarPedidos();

    } finally {
        botaoCadastrar.disabled = false;
        botaoAdicionar.disabled = false;
        botaoCadastrar.textContent = "Cadastrar todos os pedidos";
    }
});


// ======================================
// VERIFICAR SERVIÇOS
// ======================================

async function verificarServicos() {
    const indicadorPrincipal = document.querySelector(
        ".header-status .status-indicator"
    );

    try {
        const resposta = await fetch("/health");

        if (!resposta.ok) {
            throw new Error("API indisponível.");
        }

        const dados = await resposta.json();

        atualizarIndicador("api-status", "API operacional");

        indicadorPrincipal.classList.remove("offline");

        atualizarStatusServico("status-api", "Online", true);
        atualizarStatusServico(
            "status-redis",
            dados.redis === "conectado" ? "Online" : "Offline",
            dados.redis === "conectado"
        );
        atualizarStatusServico(
            "status-banco",
            dados.banco === "conectado" ? "Online" : "Offline",
            dados.banco === "conectado"
        );

    } catch (erro) {
        console.error("Erro ao verificar serviços:", erro);

        atualizarIndicador("api-status", "API indisponível");

        indicadorPrincipal.classList.add("offline");

        atualizarStatusServico("status-api", "Offline", false);
        atualizarStatusServico("status-redis", "Indisponível", false);
        atualizarStatusServico("status-banco", "Indisponível", false);
    }
}

function atualizarStatusServico(id, texto, online) {
    const elemento = document.getElementById(id);

    elemento.textContent = texto;
    elemento.classList.remove("online", "offline");
    elemento.classList.add(online ? "online" : "offline");
}

// ======================================
// ATUALIZAÇÃO MANUAL E AUTOMÁTICA
// ======================================

botaoAtualizar.addEventListener("click", async () => {
    await carregarPedidos();
    await verificarServicos();
});

// Carrega os dados ao abrir a página
async function inicializarDashboard() {
    await carregarPedidos();
    await verificarServicos();
}

inicializarDashboard();

// Atualiza os dados a cada 3 segundos
setInterval(() => {
    carregarPedidos();
    verificarServicos();
}, 3000);

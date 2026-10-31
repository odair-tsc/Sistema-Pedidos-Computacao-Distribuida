
from flask import Flask, request, jsonify, render_template
import redis
import json
import os
import sqlite3

app = Flask(__name__)

redis_host = os.getenv("REDIS_HOST", "localhost")
redis_port = int(os.getenv("REDIS_PORT", "6379"))
db_path = os.getenv("DB_PATH", "data/pedidos.db")

fila = redis.Redis(
    host=redis_host,
    port=redis_port,
    decode_responses=True
)


def conectar_banco():
    pasta = os.path.dirname(db_path)

    if pasta:
        os.makedirs(pasta, exist_ok=True)

    conexao = sqlite3.connect(db_path)
    conexao.row_factory = sqlite3.Row
    return conexao


def preparar_banco():
    with conectar_banco() as conexao:
        conexao.execute("""
            CREATE TABLE IF NOT EXISTS pedidos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                produto TEXT NOT NULL,
                estado TEXT NOT NULL,
                resultado TEXT
            )
        """)


preparar_banco()

@app.route("/", methods=["GET"])
def inicio():
    return render_template("index.html")


@app.route("/health", methods=["GET"])
def health():
    try:
        fila.ping()

        with conectar_banco() as conexao:
            conexao.execute("SELECT 1")

        return jsonify({
            "mensagem": "API funcionando!",
            "redis": "conectado",
            "banco": "conectado"
        })

    except (redis.RedisError, sqlite3.Error, OSError) as erro:
        return jsonify({
            "mensagem": "API ou algum serviço está indisponível",
            "erro": str(erro)
        }), 503


@app.route("/pedidos", methods=["POST"])
def criar_pedido():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({
            "erro": "Envie um JSON com o campo produto"
        }), 400

    produto = dados.get("produto")

    if not isinstance(produto, str) or not produto.strip():
        return jsonify({
            "erro": "Informe um produto válido"
        }), 400

    produto = produto.strip()

    try:
        with conectar_banco() as conexao:
            cursor = conexao.execute(
                """
                INSERT INTO pedidos (produto, estado)
                VALUES (?, ?)
                """,
                (produto, "pendente")
            )

            pedido = {
                "id": cursor.lastrowid,
                "produto": produto,
                "estado": "pendente"
            }

        try:
            fila.rpush("fila_pedidos", json.dumps(pedido))

        except redis.RedisError:
            with conectar_banco() as conexao:
                conexao.execute(
                    "UPDATE pedidos SET estado = ? WHERE id = ?",
                    ("erro_fila", pedido["id"])
                )

            return jsonify({
                "erro": "Pedido salvo, mas não foi possível enviá-lo à fila",
                "id": pedido["id"]
            }), 503

        return jsonify(pedido), 201

    except sqlite3.Error as erro:
        return jsonify({
            "erro": "Não foi possível salvar o pedido",
            "detalhe": str(erro)
        }), 500


@app.route("/pedidos", methods=["GET"])
def listar_pedidos():
    try:
        with conectar_banco() as conexao:
            linhas = conexao.execute(
                """
                SELECT id, produto, estado, resultado
                FROM pedidos
                ORDER BY id
                """
            ).fetchall()

        pedidos = [dict(linha) for linha in linhas]
        return jsonify(pedidos)

    except sqlite3.Error as erro:
        return jsonify({
            "erro": "Não foi possível consultar os pedidos",
            "detalhe": str(erro)
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
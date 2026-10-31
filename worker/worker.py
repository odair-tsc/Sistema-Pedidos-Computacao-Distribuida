
import os
import time
import json
import sqlite3
import redis

redis_host = os.getenv("REDIS_HOST", "localhost")
redis_port = int(os.getenv("REDIS_PORT", "6379"))
db_path = os.getenv("DB_PATH", "data/pedidos.db")

fila = redis.Redis(
    host=redis_host,
    port=redis_port,
    decode_responses=True,
    socket_timeout=None,
    socket_connect_timeout=10,
    health_check_interval=30
)


def processar_pedido(pedido):
    with sqlite3.connect(db_path, timeout=30) as conexao:
        conexao.execute(
            """
            UPDATE pedidos
            SET estado = ?, resultado = ?
            WHERE id = ?
            """,
            (
                "concluido",
                "Pedido processado com sucesso",
                pedido["id"]
            )
        )


print("Worker iniciado!", flush=True)

while True:
    try:
        print("Aguardando pedidos...", flush=True)

        resultado = fila.blpop("fila_pedidos", timeout=0)

        if resultado:
            nome_fila, conteudo = resultado
            pedido = json.loads(conteudo)

            print(
                "Processando pedido:",
                pedido["id"],
                pedido["produto"],
                flush=True
            )

            time.sleep(2)

            processar_pedido(pedido)

            print(
                "Pedido concluído:",
                pedido["id"],
                flush=True
            )

    except redis.exceptions.RedisError as erro:
        print("Erro de conexão com Redis:", erro, flush=True)
        time.sleep(5)

    except (json.JSONDecodeError, KeyError, sqlite3.Error) as erro:
        print("Erro ao processar pedido:", erro, flush=True)
        time.sleep(2)
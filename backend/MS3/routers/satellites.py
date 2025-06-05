from fastapi import APIRouter
from neo4j_driver import get_session

router = APIRouter(prefix="/api/satellites")

@router.get("/graph")
def get_graph():
    query = """
    MATCH (s:Satellite)-[r]->(a)
    RETURN s.name AS source, type(r) AS type, a.name AS target
    """
    session = get_session()
    result = session.run(query)

    nodes = {}
    edges = []

    for record in result:
        for node in [record["source"], record["target"]]:
            if node not in nodes:
                nodes[node] = {"id": node, "label": node}
        edges.append({
            "source": record["source"],
            "target": record["target"],
            "type": record["type"]
        })

    return {
        "nodes": list(nodes.values()),
        "links": edges
    }

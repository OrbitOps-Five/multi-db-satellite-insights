from fastapi import APIRouter, HTTPException
from neo4j_driver import get_session
from typing import Optional

router = APIRouter(prefix="/api/satellites")

@router.get("/graph")
def get_graph(
    manufacturer: Optional[str] = None,
    orbit: Optional[str] = None,
    constellation: Optional[str] = None,
    country: Optional[str] = None,
):
    try:
        query = """
        MATCH (s:Satellite)
        WHERE ($manufacturer IS NULL OR s.manufacturer = $manufacturer)
          AND ($orbit IS NULL OR s.orbit_class = $orbit)
          AND ($constellation IS NULL OR s.constellation = $constellation)
          AND ($country IS NULL OR s.country_of_operator = $country)
        OPTIONAL MATCH (s)-[r]->(a)
        RETURN s.name AS source, type(r) AS type, a.name AS target
        """


        session = get_session()
        result = session.run(
            query,
            manufacturer=manufacturer,
            orbit=orbit,
            constellation=constellation,
            country=country
        )

        nodes = {}
        edges = []

        for record in result:
            for node in [record["source"], record["target"]]:
                if node and node not in nodes:
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

    except Exception as e:
        print(f"❌ Error in /graph: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/options")
def get_options():
    try:
        session = get_session()
        query = """
        MATCH (s:Satellite)
        RETURN DISTINCT 
            s.manufacturer AS manufacturer,
            s.orbit_class AS orbit,
            s.constellation AS constellation,
            s.country_of_operator AS country
        """
        result = session.run(query)

        manufacturers = set()
        orbits = set()
        constellations = set()
        countries = set()

        for record in result:
            if record["manufacturer"]:
                manufacturers.add(record["manufacturer"])
            if record["orbit"]:
                orbits.add(record["orbit"])
            if record["constellation"]:
                constellations.add(record["constellation"])
            if record["country"]:
                countries.add(record["country"])

        return {
            "manufacturers": sorted(manufacturers),
            "orbits": sorted(orbits),
            "constellations": sorted(constellations),
            "countries": sorted(countries)
        }

    except Exception as e:
        print(f"❌ Error in /options: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

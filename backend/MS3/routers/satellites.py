from fastapi import APIRouter, HTTPException, Query
from neo4j_driver import get_session
from typing import Optional, List, Dict
from functools import wraps

import math

import orekit
import jpype
vm_env = orekit.initVM()

from org.orekit.data import DataContext, DirectoryCrawler
from org.orekit.propagation.analytical.tle import TLE, TLEPropagator
from org.orekit.time import AbsoluteDate, TimeScalesFactory
from org.orekit.frames import FramesFactory
from org.orekit.bodies import OneAxisEllipsoid
from org.orekit.utils import IERSConventions
from java.util import Date
from java.io import File

ctx = DataContext.getDefault()
mgr = ctx.getDataProvidersManager()
mgr.clearProviders()
mgr.addProvider(DirectoryCrawler(File("/app/orekit-data")))

def with_orekit_thread(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        vm_env.attachCurrentThread()
        try:
            return func(*args, **kwargs)
        finally:
            vm_env.detachCurrentThread()
    return wrapper

router = APIRouter(prefix="/api/satellites")

@router.get("/positions")
async def get_satellite_positions(
    orbit: Optional[str] = Query(None),
    constellation: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    manufacturer: Optional[str] = Query(None)
):
    query = """
    MATCH (s:Satellite)
    WHERE ($orbit IS NULL OR toUpper(s.orbit_class) = toUpper($orbit))
      AND ($constellation IS NULL OR toUpper(s.constellation) = toUpper($constellation))
      AND ($country IS NULL OR toUpper(s.country_of_operator) = toUpper($country))
      AND ($manufacturer IS NULL OR toUpper(s.manufacturer) = toUpper($manufacturer))
      AND s.tle1 IS NOT NULL AND s.tle2 IS NOT NULL
    RETURN s.name AS name, s.tle1 AS tle1, s.tle2 AS tle2
    LIMIT 100
    """

    session = get_session()
    satellites = []
    now_date = AbsoluteDate.now(ts_utc)  # Current time for propagation

    try:
        result = session.run(query, {
            "orbit": orbit,
            "constellation": constellation,
            "country": country,
            "manufacturer": manufacturer
        })

        for record in result:
            try:
                tle = TLE(record["tle1"], record["tle2"])
                propagator = TLEPropagator.selectExtrapolator(tle)
                pv = propagator.propagate(now_date).getPVCoordinates(earth_frame)
                pos = pv.getPosition()
                lat_lon = earth.transform(pos, earth_frame, now_date)
                
                satellites.append({
                    "name": record["name"],
                    "lat": lat_lon.getLatitude().toDegrees(),
                    "lon": lat_lon.getLongitude().toDegrees(),
                    "alt": lat_lon.getAltitude()
                })
            except Exception as e:
                print(f"TLE propagation failed for {record['name']}: {e}")
                continue

        return satellites

    except Exception as e:
        print(f"Error in /positions: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute satellite positions.")

@router.get("/graph3d")
@with_orekit_thread
def get_graph_with_positions(
    manufacturer:  Optional[str] = Query(None),
    orbit:         Optional[str] = Query(None),
    constellation: Optional[str] = Query(None),
    country:       Optional[str] = Query(None),
) -> Dict[str, List[Dict]]:

    def norm(v: Optional[str]) -> Optional[str]:
        if not v or v.strip().upper() == "ALL":
            return None
        return v

    m = norm(manufacturer)
    o = norm(orbit)
    c = norm(constellation)
    co= norm(country)

    # 1) Fetch satellites + relationships
    cypher = """
    MATCH (s:Satellite)
     WHERE ($m  IS NULL OR toUpper(coalesce(s.manufacturer,      '')) = toUpper($m))
       AND ($o  IS NULL OR toUpper(coalesce(s.orbit_class,      '')) = toUpper($o))
       AND ($c  IS NULL OR toUpper(coalesce(s.constellation,   '')) = toUpper($c))
       AND ($co IS NULL OR toUpper(coalesce(s.country_of_operator,'')) = toUpper($co))
    OPTIONAL MATCH (s)-[r]->(a)
    RETURN 
      s.name            AS id,
      s.manufacturer    AS manufacturer,
      s.constellation   AS constellation,
      s.country_of_operator AS country,
      s.tle1            AS tle1, 
      s.tle2            AS tle2,
      type(r)           AS type, 
      a.name            AS target
    """

    session = get_session()
    result  = session.run(cypher, m=m, o=o, c=c, co=co)

    # 2) Prepare OreKit once
    ts_utc      = TimeScalesFactory.getUTC()
    now_date    = AbsoluteDate(Date(), ts_utc)
    earth_frame = FramesFactory.getITRF(IERSConventions.IERS_2010, True)
    earth       = OneAxisEllipsoid(
        6_378_136.46, 1.0/298.257223563, earth_frame
    )

    nodes: Dict[str, Dict] = {}
    links: List[Dict]   = []

    for rec in result:
        src      = rec["id"]
        tle1     = rec.get("tle1")
        tle2     = rec.get("tle2")
        country  = rec.get("country")
        constel  = rec.get("constellation")
        manu     = rec.get("manufacturer")

        if src not in nodes and tle1 and tle2:
            try:
                tle        = TLE(tle1, tle2)
                propagator = TLEPropagator.selectExtrapolator(tle)
                pv         = propagator.propagate(now_date).getPVCoordinates(earth_frame)
                pos        = pv.getPosition()
                geo        = earth.transform(pos, earth_frame, now_date)

                lat = math.degrees(geo.getLatitude())
                lon = math.degrees(geo.getLongitude())
                alt = geo.getAltitude()

                if all(isinstance(v, float) and math.isfinite(v) for v in (lat, lon, alt)):
                    nodes[src] = {
                        "id":            src,
                        "lat":           lat,
                        "lon":           lon,
                        "alt":           alt,
                        "country":       country,
                        "constellation": constel,
                        "manufacturer":  manu
                    }
            except Exception as e:
                print(f"Propagation failed for {src}: {e}")

        tgt = rec.get("target")
        if src and tgt:
            links.append({
                "source": src,
                "target": tgt,
                "type":   rec.get("type")
            })

    return {"nodes": list(nodes.values()), "links": links}

    
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
        print(f"Error in /graph: {e}")
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
        print(f"Error in /options: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

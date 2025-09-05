
import requests
from backend.utils import read_api_key
import logging


S2_API_KEY = read_api_key()

def retrieve_paper(paper_id):

    rsp = requests.get(
        f'https://api.semanticscholar.org/graph/v1/paper/{paper_id}',
        headers={'X-API-KEY': S2_API_KEY},
        params={'fields': 'title,url,year,authors,openAccessPdf,references,externalIds,referenceCount,fieldsOfStudy,s2FieldsOfStudy,journal,tldr,externalIds'})
    
    if rsp.status_code == 200:
        logging.info("Retrieving paper %s successful", paper_id)
        return rsp.json()
    else:
        logging.error(
            "Retrieving paper returned status %s for query %s",
            rsp.status_code, paper_id
        )
        return None
    

def get_paper_references_information(paper_id, limit=100):

    rsp = requests.get(
        f'https://api.semanticscholar.org/graph/v1/paper/{paper_id}/references',
        headers={'X-API-KEY': S2_API_KEY},
        params={
            'fields': 'contexts,intents,isInfluential,abstract', 
            'limit': limit})
    
    if rsp.status_code == 200:
        logging.info("Retrieving paper %s successful", paper_id)
        return rsp.json()
    else:
        logging.error(
            "Retrieving paper returned status %s for query %s",
            rsp.status_code, paper_id
        )
        return None

def get_paper_citations_information(paper_id, limit=1000):
    
    rsp = requests.get(
        f'https://api.semanticscholar.org/graph/v1/paper/{paper_id}/citations',
        headers={'X-API-KEY': S2_API_KEY},
        params={
            'fields': 'contexts,intents,isInfluential,abstract',
            'limit': limit,
            })
    
    if rsp.status_code == 200:
        logging.info("Retrieving paper %s successful", paper_id)
        return rsp.json()
    else:
        logging.error(
            "Retrieving paper returned status %s for query %s",
            rsp.status_code, paper_id
        )
        return None


def get_paper_recommendations(paper_id, limit=100):
      
    rsp = requests.get(
        f'http://api.semanticscholar.org/recommendations/v1/papers/forpaper/{paper_id}',
        headers={'X-API-KEY': S2_API_KEY},
        params={
            'fields': 'title,url,authors',
            'limit': limit,
            })
    
    if rsp.status_code == 200:
        logging.info("Retrieving paper %s successful", paper_id)
        return rsp.json()
    else:
        logging.error(
            "Retrieving paper returned status %s for query %s",
            rsp.status_code, paper_id
        )
        return None
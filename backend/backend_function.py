import requests
from backend.utils import read_api_key
from backend.text_extraction import extract_pdf_text_from_url
from backend.data_member import SemanticNode, Graph
import logging
import regex as re


S2_API_KEY = read_api_key()


def search_for_papers(paper_title, limit=20):
    rsp = requests.get(
        'https://api.semanticscholar.org/graph/v1/paper/search',
        headers={'X-API-KEY': S2_API_KEY},
        params={'query': paper_title, 'limit': str(limit)}
    )

    if rsp.status_code == 200:
        logging.info("Search for paper %s successful", paper_title)
        rsp_json = rsp.json()

        while True:  # Dangerous while true loop - keep going till ss returns a good response
            try:
                papers_bulk_search = bulk_retrieve_papers(
                   [i['paperId'] for i in rsp_json['data']])  # Returning only the papers that have references
                if papers_bulk_search is not None:
                    break
            except Exception as e:
                continue
        return [i for i in papers_bulk_search if i['references'] is not None]
    else:
        logging.error(
            "Search for paper returned status %s for query %s",
            rsp.status_code, paper_title
        )
        return None

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
    

def bulk_retrieve_papers(paper_ids):

    rsp = requests.post(
    'https://api.semanticscholar.org/graph/v1/paper/batch',
    headers={'X-API-KEY': S2_API_KEY},
    params={'fields': 'referenceCount,citationCount,title,authors,openAccessPdf,externalIds,corpusId,year,influentialCitationCount,fieldsOfStudy,s2FieldsOfStudy,journal,authors,references,tldr'},
    json={"ids": paper_ids}
    )

    if rsp.status_code == 200:
        logging.info("Retriving bulk papers  for %s papers successful", len(paper_ids))
        return rsp.json()
    else:
        logging.error(
            "Retrieving bulk papers returned status %s for %s papers",
            rsp.status_code, len(paper_ids)
        )
        return None


def get_paper_pdf_urls(paper_objects):

    pdf_urls = []
    pattern = r"https?://[^\s,]+"  # matches http or https until a space or comma
    failure_counter = 0
    for i in paper_objects:
        try:
            pdf = i.get('openAccessPdf', {})
            url_candidate = pdf.get('url')
            if url_candidate and 'email' not in url_candidate:
                url = url_candidate
            else:
                disclaimer = i['openAccessPdf']['disclaimer']
                url = re.findall(pattern, disclaimer)[0]
                if 'email' in url:
                    url = ''
                if '/abs/' in url:  # Replacing arxiv abs pages to pdf
                    url = url.replace('/abs/', '/pdf/')
        except Exception as e:
            logging.error('Error in extracting pdf url for %s', i)
            failure_counter += 1
            url = ''

        pdf_urls.append(url)

    logging.info("Finished extracting pdf urls with %s failures", failure_counter)

    return pdf_urls


def get_connected_graph(work, search_query="", relevance_search=True):
    # Given primary work - main node information, get the bulk references, extract pdf for all and create the connected graph

    reference_ids = [i['paperId'] for i in work['references']]

    reference_papers = bulk_retrieve_papers(paper_ids=reference_ids)

    paper_objects = [work] + reference_papers

    paper_urls = get_paper_pdf_urls(reference_papers)

    paper_objects = [i for i in paper_objects if i]

    nodes = [SemanticNode(i) for i in paper_objects]

    graph = Graph(
        nodes=nodes, primary_node=nodes[0], search_query=search_query)

    if relevance_search:
        pdf_urls = get_paper_pdf_urls(paper_objects=paper_objects)
        fulltexts = [extract_pdf_text_from_url(i) for i in pdf_urls]
        for i, j in zip(fulltexts, graph.nodes):
            if i:
                j.fullltext = i
                j.has_fulltext = True

        graph.weigh_nodes()
    else:
        graph.randomly_weigh_nodes()

    return graph.get_json()
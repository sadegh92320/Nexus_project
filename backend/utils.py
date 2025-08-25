import requests
from backend.data_member import Node, Graph
from backend.text_extraction import extract_pdf_text_from_url


def bulk_retrieve_works(ids: list[str], extract_from_url: bool = True):
    """
    Bulk retrieves works based on openalex ids. Accepts both urls and pure ids

    Args:
        ids - List of open alex ids
    Returns:
        works : list[Works] - unformatted data object
    """
    if extract_from_url:
        ids = [url.rstrip('/').split('/')[-1] for url in ids]

    pipe_separated_ids = "|".join(ids)
    r = requests.get(
        f"https://api.openalex.org/works?filter=ids.openalex:{pipe_separated_ids}&per-page=50")
    
    if r.status_code == 200:
        works = r.json()['results']
    else:
        print(f"Error fetching works {ids}: Status {r.status_code}")
        return None
    
    return works


def search_by_title(title_query: str, n_results: int = 50):
    """
    Search OpenAlex by a title query
    """
    
    url = "https://api.openalex.org/works"
    params = {
        "search": title_query,
        "per_page": n_results
    }

    response = requests.get(url, params=params)
    if response.status_code != 200:
        print(f"Error {response.status_code}: {response.text}")
        return []

    data = response.json()
    return data["results"]
    

def convert_work_to_node(
        work, validate_fulltext: bool = True, supress_errors: bool = False):
    """
    Given an OpenAlex work object - converts to a Graph Node from data_members.py
    """

    node = Node()
    
    try:
        node.id = work['id'].rstrip('/').split('/')[-1]
        node.title = work['title']
        node.primary_topic = work['primary_topic']['display_name']
        node.subfield = work['primary_topic']['subfield']["display_name"]
        node.field = work['primary_topic']['field']["display_name"]
        node.domain = work['primary_topic']['domain']["display_name"]
        #subfields = [i['display_name'] for i in work['primary_topic']['subfield']]
        node.topics = [i['display_name'] for  i in  work['topics']]
        node.keywords = [i['display_name'] for i in work['keywords']]
        node.total_citations = work['cited_by_count']
        node.publication_year = work['publication_year']
        node.doi = work['doi']
        node.authors = work['authorships']
        node.cites_by_id = [url.rstrip('/').split('/')[-1] for url in work['referenced_works']]

        if validate_fulltext:
            if work['has_fulltext']:
                oa_url = work['open_access']['oa_url']

                fulltext = extract_pdf_text_from_url(oa_url)
                if fulltext:
                    node.has_fulltext = True
                    node.fulltext = fulltext
                else:
                    node.has_fulltext = False
            else:
                node.has_fulltext = False
            
    except Exception as e:
        if not supress_errors:
            print(f"Exception {e}")

    return node


def read_api_key():
    with open(
        r'C:\Users\Parv\Doc\Nexus_project\backend\semantic_scholar_api_key.txt') as f:
        key = f.readlines()

    return key[0]
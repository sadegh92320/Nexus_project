from backend.utils import bulk_retrieve_works, search_by_title, convert_work_to_node
from backend.data_member import Node, Graph
from typing import List, Tuple
from backend.paper_similarity import get_paper_similarity
import json
from backend.backend_function import search_for_papers, get_connected_graph

search_input = input("Enter your search term:  ")
print()

works = search_for_papers(search_term=search_input)  # Make search query to OpenAlex API


print("Select paper:")  # Send recommendations for paper selection
for counter, i in enumerate(works):
    print(f"{counter} : {i['title']} \n")

paper_number = input("Select paper, -1 to leave:  ")
    
if paper_number == -1:   # Take valid paper number input
    exit()
    
paper = works[int(paper_number)]

connected_graph = get_connected_graph(
    paper, write_to_file=True, first_3=True)

"""
primary_node = convert_work_to_node(paper)

try:
    referenced_works = bulk_retrieve_works(primary_node.cites_by_id)
except Exception as e:
    print("References unextracted - breaking")
    exit()

nodes = [convert_work_to_node(i, supress_errors=True) for i in referenced_works]  # Convert references to works - gets fulltexts

if fulltext_relevance:
    filtered_nodes = [i for i in nodes if i.has_fulltext]
else:
    filtered_nodes = nodes

# Create graph
graph = Graph(
    nodes = filtered_nodes, search_query=search_input, primary_node=primary_node)

print("Graph created - getting relevance scores")

if not primary_node.has_fulltext:
    print("The primary node does not have a fulltext, restart!")
    exit()

for i, node in enumerate(graph.nodes[1:]):

    progress_bar = i+1 / (len(graph.nodes) - 1) * 100
    print(f"{progress_bar} % completed\n")

    try:
        if hasattr(node, "fulltext"):
            relevance, k1, k2 = get_paper_similarity(
                primary_node.fulltext, node.fulltext)
    except Exception as e:
        print("Exception {e}")
        node.relevance = 0.2
        continue

    node.relevance = float(relevance)
    if k2:
        node.keywords = k2

graph_json = graph.get_json()

with open(f"{search_input}_graph.json", "w") as file:
    json.dump(graph_json, file)
"""


import re
import stanza
from keybert import KeyBERT
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# ---------------------------
# Setup: Stanza & Models
# ---------------------------
stanza.download('en', processors='tokenize,pos,lemma,depparse')
nlp = stanza.Pipeline('en', processors='tokenize,pos,lemma,depparse', tokenize_no_ssplit=True, use_gpu=True)
kw_model = KeyBERT(model='all-MiniLM-L6-v2')
embedder = SentenceTransformer('all-MiniLM-L6-v2')

# ---------------------------
# Text Cleaning
# ---------------------------
def fix_split_words(text):
    return re.sub(r"(\b\w+)-\s+(\w+\b)", r"\1\2", text)

def expand_and_remove_acronyms(text):
    pattern = r"\b([A-Z][a-zA-Z](?:\s+[A-Z][a-zA-Z])*)\s+\(([A-Z]{2,})\)"
    matches = re.findall(pattern, text)
    acronym_map = {acronym: full_form for full_form, acronym in matches}
    text = re.sub(pattern, lambda m: m.group(1), text)
    for acronym, full_form in acronym_map.items():
        text = re.sub(rf"\b{acronym}\b", full_form, text)
    return text

def clean_text(text):
    text = re.sub(r"\[\d+\]", "", text)  # remove citations like [1]
    text = re.sub(r"\s+", " ", text)  # normalize spaces
    return text.strip()

# ---------------------------
# Fallback Noun Extraction (Stanza)
# ---------------------------
def extract_nouns(text):
    doc = nlp(text)
    nouns = [word.lemma for sent in doc.sentences for word in sent.words if word.upos in ["NOUN", "PROPN"]]
    return nouns

# ---------------------------
# Keyword Extraction with Fallback
# ---------------------------
def extract_keywords(text, top_n=20):
    # Primary: KeyBERT
    keywords = kw_model.extract_keywords(
        text,
        keyphrase_ngram_range=(1, 3),
        stop_words='english',
        use_maxsum=True,
        top_n=top_n
    )
    keywords = [kw for kw, _ in keywords]

    # Fallback: Noun extraction if KeyBERT fails
    if not keywords:
        print("⚠ KeyBERT found no keywords. Falling back to noun extraction.")
        keywords = extract_nouns(text)

    return list(dict.fromkeys(keywords))  # remove duplicates, preserve order

# ---------------------------
# Similarity Computation
# ---------------------------
def compute_similarity(keywords1, keywords2):
    if not keywords1 or not keywords2:
        print("⚠ One paper has no keywords. Returning similarity=0.")
        return 0.0
    emb1 = embedder.encode(keywords1)
    emb2 = embedder.encode(keywords2)
    sims = cosine_similarity(emb1, emb2)
    return sims.max(axis=1).mean()

# ---------------------------
# Main Paper Similarity Function
# ---------------------------

def get_paper_similarity(paper1_text, paper2_text):
    # Clean texts
    paper1_text = clean_text(expand_and_remove_acronyms(fix_split_words(paper1_text)))
    paper2_text = clean_text(expand_and_remove_acronyms(fix_split_words(paper2_text)))

    # Extract keywords (always guaranteed)
    keywords1 = extract_keywords(paper1_text)
    keywords2 = extract_keywords(paper2_text)

    # Compute similarity
    return compute_similarity(keywords1, keywords2), keywords1, keywords2
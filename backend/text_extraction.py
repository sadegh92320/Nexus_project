import regex as re
import requests
import fitz

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
# Extracting fulltexts from pdf url
# ---------------------------

def extract_pdf_text_from_url(url, save_as="temp.pdf"):
    """
    Extract fulltext from pdf url - returns none for failed extraction"""

    try:
        response = requests.get(url)
        with open(save_as, "wb") as f:
            f.write(response.content)

        doc = fitz.open(save_as)
        full_text = []
        for page in doc:
            full_text.append(page.get_text())
        doc.close()

    except Exception as e:
        print(f"Pdf extraction error {e}")
        return None
    
    full_text = "\n\n".join(full_text)
    if len(full_text) < 300:
        return None
    
    return clean_text(expand_and_remove_acronyms(fix_split_words(full_text)))
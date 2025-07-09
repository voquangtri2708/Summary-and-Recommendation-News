from gensim.models import word2vec
import pandas as pd
from function.preprocessing import NormalizeText
from function.embedding import PatchEmbedding, MeanVectorizer
from flask import Flask, render_template, request, jsonify
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
import requests
from boilerpy3.extractors import ArticleExtractor

app = Flask(__name__, template_folder='templates')

# Load models and data
device = "cuda" if torch.cuda.is_available() else "cpu"
tokenizer = AutoTokenizer.from_pretrained("./models/SummaryNews")
model = AutoModelForSeq2SeqLM.from_pretrained("./models/SummaryNews").to(device)

word_model = word2vec.Word2Vec.load('./models/word.model')
news = pd.read_csv('./data/cleaned_vnexpress.csv')

# Define user-defined classes
normalizer = NormalizeText()
pemb = PatchEmbedding(word_model=word_model, stopword_path="./data/vietnamese-stopwords-dash.txt")

topic_mapping = {
    'doi-song': 'Đời sống',
    'du-lich': 'Du lịch',
    'the-thao': 'Thể thao',
    'giao-duc': 'Giáo dục',
    'khoa-hoc': 'Khoa học',
    'giai-tri': 'Giải trí'
}

mvectorize = MeanVectorizer(word_model=word_model)
input_gensim = normalizer.create_input_gensim(news, 'tag')
post_embeddings = pemb.post_embedding(input_gensim, length=len(input_gensim))
mean_post_embedding = mvectorize.mean_posts_embedding(post_embeddings)

def get_main_content(url):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        extractor = ArticleExtractor()
        main_content = extractor.get_content(response.text)
        return main_content
    except requests.exceptions.RequestException as e:
        return f"Error fetching the page: {e}"

def fetch_and_process_url(url):
    content = get_main_content(url)
    content = content.replace('\n', ' ')
    return content

def summarize_text(text):
    inputs = tokenizer.encode("summarize: " + text, return_tensors="pt", max_length=512, truncation=True).to(device)
    outputs = model.generate(inputs, max_length=128, num_beams=4, early_stopping=True)
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

def suggest_articles(text):
    question_embeddings = pemb.sentence_embedding(text)

    mean_sentence_embedding = mvectorize.mean_vector_embedding(question_embeddings)
    # mean_post_embedding = mvectorize.mean_posts_embedding(post_embeddings) #Co the tinh truoc de tiet kiem thoi gian
    similarity_score = mvectorize.text_cosine_similarity(mean_sentence_embedding, mean_post_embedding)
    similar_news = mvectorize.find_similarity(similarity_score, news)
    similar_news = similar_news[['topic', 'title', 'url']]
    
    similar_news['topic'] = similar_news['topic'].map(topic_mapping)
    similar_news.columns = ['Chủ đề', 'Tiêu đề', 'URL']
    similar_news['Tiêu đề'] = similar_news.apply(lambda row: f'<a href="{row["URL"]}" target="_blank">{row["Tiêu đề"]}</a>', axis=1)
    return similar_news[['Tiêu đề']].to_html(classes='data', index=False, escape=False)

@app.route('/', methods=['GET', 'POST'])
def index():
    return render_template('index.html')

@app.route('/process', methods=['POST'])
def process():
    data = request.json
    message = data.get('message')
    option = data.get('option')
    
    if is_valid_url(message):
        content = fetch_and_process_url(message)
    else:
        content = message
    
    if option == 'Text summary':
        response = summarize_text(content)
    else:
        response = suggest_articles(content)
    
    return jsonify({'response': response})

@app.route('/fetch-url-content', methods=['POST'])
def fetch_url_content():
    data = request.json
    url = data.get('url')
    content = fetch_and_process_url(url)
    return jsonify({'content': content})

def is_valid_url(string):
    try:
        requests.get(string)
        return True
    except:
        return False

if __name__ == '__main__':
    app.run(debug=True)
import requests
import json

def test_all():
    print("=== 1. TESTING SMART SEARCH ===")
    r_search = requests.get('http://127.0.0.1:8000/api/search/search', params={'query': 'heat action plans temperature thresholds', 'strategy': 'hybrid_rrf'})
    print("Smart Search GET Status:", r_search.status_code)
    search_res = r_search.json()
    print("Query:", search_res.get('query'), "Results count:", len(search_res.get('results', [])))
    if search_res.get('results'):
        top = search_res['results'][0]
        print(f" Top Match: Doc {top.get('document_id')}, Page {top.get('page_number')}, Score: {top.get('score')}")
        print(" Snippet:", top.get('snippet', '')[:120])

    r_ask = requests.post('http://127.0.0.1:8000/api/search/ask', json={'question': 'What are the temperature thresholds in heat action plans?', 'document_id': 1})
    print("Smart Search ASK Status:", r_ask.status_code)
    ask_res = r_ask.json()
    print("Answer:", ask_res.get('answer')[:200] if ask_res.get('answer') else 'No answer')
    print("Sources count:", len(ask_res.get('sources', [])))

    print("\n=== 2. TESTING BRAIN MAP ===")
    r_bm_gen = requests.post('http://127.0.0.1:8000/api/brainmap/generate', json={'document_id': 1})
    print("Brain Map Generate Status:", r_bm_gen.status_code)
    bm_gen = r_bm_gen.json()
    print("Title:", bm_gen.get('title'), "Nodes:", len(bm_gen.get('nodes', [])), "Edges:", len(bm_gen.get('edges', [])))
    if bm_gen.get('nodes'):
        print("Sample Nodes:", [n.get('label') for n in bm_gen['nodes'][:4]])

    print("\n=== 3. TESTING QUIZ MASTER ===")
    r_quiz = requests.post('http://127.0.0.1:8000/api/quiz/generate', json={'document_id': 1, 'quiz_type': 'mcq', 'count': 4})
    print("Quiz Master Status:", r_quiz.status_code)
    quiz_res = r_quiz.json()
    print("Quiz Topic:", quiz_res.get('topic'), "Questions count:", len(quiz_res.get('questions', [])))
    for i, q in enumerate(quiz_res.get('questions', [])[:2]):
        print(f" Q{i+1}: {q.get('question')}")
        print(f"  Options: {q.get('options')}")
        print(f"  Answer: {q.get('answer')}")

    print("\n=== 4. TESTING DATA STORYTELLER ===")
    r_story = requests.post('http://127.0.0.1:8000/api/data/analyze-document', json={'document_id': 1})
    print("Doc Data Story Status:", r_story.status_code)
    story_res = r_story.json()
    print("Doc Story Success:", story_res.get('success'), "Total Pages:", story_res.get('total_pages'), "Total Words:", story_res.get('total_words'))
    print("Empirical Markers count:", len(story_res.get('quantitative_markers', [])))
    print("Clusters count:", len(story_res.get('clusters', [])))

    r_clusters = requests.get('http://127.0.0.1:8000/api/data/document-clusters')
    print("Clusters Status:", r_clusters.status_code, "Cluster count:", len(r_clusters.json().get('clusters', [])))

    print("\n=== 5. TESTING LECTURE SYNC ===")
    r_lec = requests.get('http://127.0.0.1:8000/api/lecture/list')
    print("Lecture List Status:", r_lec.status_code, "Count:", len(r_lec.json().get('lectures', [])))
    r_vis = requests.get('http://127.0.0.1:8000/api/lecture/1/visuals')
    print("Lecture Visuals Status:", r_vis.status_code, "Count:", r_vis.json().get('count'))

if __name__ == '__main__':
    test_all()

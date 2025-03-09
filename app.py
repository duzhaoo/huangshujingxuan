from flask import Flask, render_template
from feishu import FeishuAPI

app = Flask(__name__)
feishu_api = FeishuAPI()

@app.route('/')
def index():
    # 获取飞书多维表格数据
    records = feishu_api.get_table_records()
    articles = []
    
    for record in records:
        fields = record.get('fields', {})
        article = {
            'title': fields.get('标题', ''),
            'quote': fields.get('金句输出', ''),
            'comment': fields.get('黄叔点评', ''),
            'content': str(fields.get('概要内容输出', ''))[:100] + '...' if fields.get('概要内容输出') else ''
        }
        articles.append(article)
    
    return render_template('index.html', articles=articles)

if __name__ == '__main__':
    app.run(debug=True)
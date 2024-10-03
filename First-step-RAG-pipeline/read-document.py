import argparse
import json
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.document_loaders import WebBaseLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter


def load_pdf_document(file_path):
    document_loader = PyPDFLoader(file_path)
    return document_loader.load()


def load_web_document(url):
    web_loader = WebBaseLoader(url)
    return web_loader.load()


def save_document(text_list):
    text_chunks = []
    for text in text_list:
        # text_chunks.append([text.page_content, text.metadata])
        text_chunks.append(text.page_content)
    with open('data.json', 'w', encoding='utf-8') as file:
        json.dump(text_chunks, file, ensure_ascii=False, indent=4)


def splitter(size, overlap):
    # Initialize the text splitter
    return RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", " ", ""]
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Take the source type and the path to the source.')
    parser.add_argument('source_path', type=str, help='The path to the source.')
    parser.add_argument('-s', '--chunk_size', type=int, default=450, help='Chunk size for data splitting')
    parser.add_argument('-o', '--overlap', type=int, default=20, help='Chunk overlap for data splitting')
    parser.add_argument('-t', '--source_type', type=str, default='pdf', choices=['pdf', 'web'],
                        help='The type of the source. The options are: pdf, web.')


    args = parser.parse_args()
    r_splitter = splitter(args.chunk_size, args.overlap)
    split_text = []
    if args.source_type == 'pdf':
        pages = load_pdf_document(args.source_path)
        split_text = r_splitter.split_documents(pages)
    elif args.source_type == 'web':
        docs = load_web_document(args.source_path)
        split_text = r_splitter.split_documents(docs)

    save_document(split_text)

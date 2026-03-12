FROM python:3.13-slim
 
WORKDIR /app
 
COPY index.html ./
COPY js/ ./js/
COPY css/ ./css/
COPY data/ ./data/
 
EXPOSE 8080
 
CMD ["python3", "-m", "http.server", "8080", "--bind", "0.0.0.0"]

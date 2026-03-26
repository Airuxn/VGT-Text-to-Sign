FROM python:3.12-alpine
WORKDIR /app
COPY web .
EXPOSE 5173
CMD ["python3", "-m", "http.server", "5173"]

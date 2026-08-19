from flask import Flask, request, jsonify
import numpy as np
import cv2
import base64
import os
from deepface import DeepFace
import time

app = Flask(__name__)

# Security: API Key required
API_KEY = os.environ.get("DEEPFACE_API_KEY", "dev-secret-key")

def verify_api_key():
    key = request.headers.get("X-API-Key")
    if key != API_KEY:
        return False
    return True

def decode_image(base64_string):
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    img_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "DeepFace Real-Time"})

@app.route("/face/register", methods=["POST"])
def register():
    if not verify_api_key():
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    image_b64 = data.get("image")
    
    try:
        img = decode_image(image_b64)
        
        # 1. Extract embedding using ArcFace
        # 2. Anti-spoofing check
        objs = DeepFace.represent(
            img_path=img,
            model_name="ArcFace",
            enforce_detection=True,
            detector_backend="opencv",
            align=True,
            anti_spoofing=True
        )
        
        if not objs:
            return jsonify({"error": "Nenhum rosto detectado"}), 400
            
        obj = objs[0]
        
        # Liveness check
        if obj.get("is_real") is False:
            return jsonify({"error": "Falha no anti-spoofing: Foto/Vídeo detectado"}), 400
            
        embedding = obj.get("embedding")
        
        return jsonify({
            "success": True,
            "embedding": embedding,
            "face_detected": True,
            "antispoof_score": obj.get("antispoof_score", 0)
        })
        
    except Exception as e:
        print(f"Error in register: {str(e)}")
        return jsonify({"error": str(e)}), 400

@app.route("/face/verify", methods=["POST"])
def verify():
    if not verify_api_key():
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    image_b64 = data.get("image")
    target_embedding = data.get("target_embedding")
    
    if not target_embedding:
        return jsonify({"error": "Target embedding missing"}), 400
        
    try:
        img = decode_image(image_b64)
        
        # Represent capture to compare
        objs = DeepFace.represent(
            img_path=img,
            model_name="ArcFace",
            enforce_detection=True,
            detector_backend="opencv",
            align=True,
            anti_spoofing=True
        )
        
        if not objs:
            return jsonify({"error": "Nenhum rosto detectado"}), 400
            
        obj = objs[0]
        
        # Liveness check
        if obj.get("is_real") is False:
            return jsonify({"error": "Falha no anti-spoofing: Foto/Vídeo detectado"}), 400
            
        captured_embedding = obj.get("embedding")
        
        # Compare embeddings (Cosine distance)
        # DeepFace.verify also does this but we want full control
        # DeepFace internal distance for ArcFace cosine threshold is usually around 0.68
        
        result = DeepFace.verify(
            img1_path=captured_embedding, 
            img2_path=target_embedding,
            model_name="ArcFace",
            distance_metric="cosine",
            enforce_detection=False # already detected
        )
        
        return jsonify({
            "verified": result["verified"],
            "distance": result["distance"],
            "face_detected": True,
            "antispoof_score": obj.get("antispoof_score", 0)
        })
        
    except Exception as e:
        print(f"Error in verify: {str(e)}")
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

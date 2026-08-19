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
        
        # ARC FACE COSINE THRESHOLD: 0.68 is standard for DeepFace/ArcFace
        # We perform manual cosine similarity calculation as requested
        
        captured_vec = np.array(captured_embedding)
        target_vec = np.array(target_embedding)
        
        # Validate dimensionality (ArcFace is 512)
        if captured_vec.shape != (512,) or target_vec.shape != (512,):
            return jsonify({"error": f"Dimensionalidade inválida: {captured_vec.shape} vs {target_vec.shape}"}), 400

        # Cosine distance = 1 - Cosine Similarity
        dot_product = np.dot(captured_vec, target_vec)
        norm_captured = np.linalg.norm(captured_vec)
        norm_target = np.linalg.norm(target_vec)
        
        cosine_similarity = dot_product / (norm_captured * norm_target)
        distance = 1 - cosine_similarity
        
        # ArcFace threshold for cosine distance is typically 0.68
        threshold = 0.68
        verified = bool(distance <= threshold)

        
        return jsonify({
            "verified": verified,
            "distance": float(distance),
            "face_detected": True,
            "antispoof_score": float(obj.get("antispoof_score", 0))
        })

        
    except Exception as e:
        print(f"Error in verify: {str(e)}")
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

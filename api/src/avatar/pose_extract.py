import argparse
import json
import os
import tempfile

import cv2
import mediapipe as mp
import requests

from mediapipe.tasks import python
from mediapipe.tasks.python import vision

MODEL_HAND_URL = (
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
)
# Heavy model: far more reliable on real dictionary clips (signers, framing) than lite.
MODEL_POSE_URL = (
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task'
)
MODEL_FACE_URL = (
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
)

DIR = os.path.dirname(__file__)
HAND_MODEL = os.path.join(DIR, 'hand_landmarker.task')
POSE_MODEL = os.path.join(DIR, 'pose_landmarker_heavy.task')
FACE_MODEL = os.path.join(DIR, 'face_landmarker.task')

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]

# MediaPipe Pose (33 landmarks) — lite/full share topology.
POSE_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 7),
    (0, 4), (4, 5), (5, 6), (6, 8),
    (9, 10),
    (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19),
    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    (11, 23), (12, 24), (23, 24), (23, 25), (24, 26),
    (25, 27), (26, 28), (27, 29), (28, 30), (29, 31), (30, 32), (27, 31), (28, 32),
]


def ensure_model(url: str, model_path: str) -> str:
    if os.path.exists(model_path):
        return model_path
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    r = requests.get(url, stream=True, timeout=180)
    r.raise_for_status()
    with open(model_path, 'wb') as f:
        for chunk in r.iter_content(chunk_size=1024 * 1024):
            if chunk:
                f.write(chunk)
    return model_path


def download_to_temp(video_url: str) -> str:
    r = requests.get(video_url, stream=True, timeout=180)
    r.raise_for_status()

    fd, tmp_path = tempfile.mkstemp(suffix='.mp4')
    os.close(fd)

    with open(tmp_path, 'wb') as f:
        for chunk in r.iter_content(chunk_size=1024 * 1024):
            if chunk:
                f.write(chunk)

    return tmp_path


def to_xyz(lm, scale=1.0):
    x = (lm.x - 0.5) * 2.0 * scale
    y = (0.5 - lm.y) * 2.0 * scale
    z = -getattr(lm, 'z', 0.0) * scale
    return [float(x), float(y), float(z)]


def extract_keyframes(video_url: str, out_path: str, fps: float, max_ms: int):
    ensure_model(MODEL_HAND_URL, HAND_MODEL)
    ensure_model(MODEL_POSE_URL, POSE_MODEL)
    ensure_model(MODEL_FACE_URL, FACE_MODEL)

    BaseOptions = mp.tasks.BaseOptions
    VisionRunningMode = vision.RunningMode

    hand_opts = vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=HAND_MODEL),
        running_mode=VisionRunningMode.VIDEO,
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    pose_opts = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=POSE_MODEL),
        running_mode=VisionRunningMode.VIDEO,
        num_poses=1,
        # Dictionary videos: variable lighting / crops; lower thresholds help full-body detection.
        min_pose_detection_confidence=0.25,
        min_pose_presence_confidence=0.25,
        min_tracking_confidence=0.25,
    )
    face_opts = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=FACE_MODEL),
        running_mode=VisionRunningMode.VIDEO,
        num_faces=1,
        min_face_detection_confidence=0.35,
        min_face_presence_confidence=0.35,
        min_tracking_confidence=0.35,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )

    native_fps = 30.0
    cap = None
    tmp_path = None

    try:
        tmp_path = download_to_temp(video_url)
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise RuntimeError('Failed to open video')

        native_fps = cap.get(cv2.CAP_PROP_FPS) or native_fps
        if native_fps <= 1e-3:
            native_fps = 30.0

        step = max(int(round(native_fps / fps)), 1)

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        max_frame = total_frames
        if max_ms and max_ms > 0 and total_frames > 0:
            max_frame = min(total_frames, int(round((max_ms / 1000.0) * native_fps)))

        keyframes = []

        with vision.HandLandmarker.create_from_options(hand_opts) as hand_lm:
            with vision.PoseLandmarker.create_from_options(pose_opts) as pose_lm:
                with vision.FaceLandmarker.create_from_options(face_opts) as face_lm:
                    frame_idx = 0
                    while True:
                        if max_frame and frame_idx >= max_frame:
                            break

                        if not cap.grab():
                            break

                        if frame_idx % step != 0:
                            frame_idx += 1
                            continue

                        ok, frame = cap.retrieve()
                        if not ok:
                            break

                        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                        t_ms = (frame_idx / native_fps) * 1000.0
                        ts = int(t_ms)

                        h_res = hand_lm.detect_for_video(mp_image, ts)
                        p_res = pose_lm.detect_for_video(mp_image, ts)
                        f_res = face_lm.detect_for_video(mp_image, ts)

                        left_lms = None
                        right_lms = None
                        hand_landmarks = getattr(h_res, 'hand_landmarks', None) or []
                        handedness = getattr(h_res, 'handedness', None) or []

                        for i, hand_lms in enumerate(hand_landmarks):
                            label = None
                            try:
                                if len(handedness) > i and len(handedness[i]) > 0:
                                    label = handedness[i][0].category_name
                            except Exception:
                                label = None

                            xyz = [to_xyz(lm, scale=1.0) for lm in hand_lms]
                            if label and str(label).lower().startswith('left'):
                                left_lms = xyz
                            elif label and str(label).lower().startswith('right'):
                                right_lms = xyz
                            else:
                                if left_lms is None:
                                    left_lms = xyz
                                else:
                                    right_lms = xyz

                        pose_pts = None
                        plms = getattr(p_res, 'pose_landmarks', None) or []
                        if plms and len(plms) > 0:
                            pose_pts = [to_xyz(lm, scale=1.0) for lm in plms[0]]

                        face_pts = None
                        flms = getattr(f_res, 'face_landmarks', None) or []
                        if flms and len(flms) > 0:
                            face_pts = [to_xyz(lm, scale=1.0) for lm in flms[0]]

                        keyframes.append({
                            'tMs': float(t_ms),
                            'pose': pose_pts,
                            'face': face_pts,
                            'left': left_lms,
                            'right': right_lms,
                        })

                        frame_idx += 1

        out = {
            'schemaVersion': 2,
            'poseModel': 'heavy',
            'videoUrl': video_url,
            'fps': float(fps),
            'nativeFps': float(native_fps),
            'maxMs': int(max_ms) if max_ms else None,
            'poseConnections': [[a, b] for a, b in POSE_CONNECTIONS],
            'handConnections': [[a, b] for a, b in HAND_CONNECTIONS],
            'keyframes': keyframes,
        }

        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(out, f)

    finally:
        if cap is not None:
            cap.release()
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--videoUrl', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--fps', type=float, default=12.0)
    ap.add_argument('--maxMs', type=int, default=0)
    args = ap.parse_args()

    extract_keyframes(args.videoUrl, args.out, args.fps, args.maxMs)


if __name__ == '__main__':
    main()

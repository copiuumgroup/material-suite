import sys
import json
import os
import torch
import traceback
from audio_separator.separator import Separator
from pedalboard import Pedalboard, PitchShift
import soundfile as sf

# Initialize Engine State
class StudioEngine:
    def __init__(self):
        self.separator = None
        self.output_dir = os.path.join(os.path.expanduser("~"), "Music", "MaterialSuite", "Stems")
        os.makedirs(self.output_dir, exist_ok=True)
        self.log("Engine Initialized. CUDA Available: " + str(torch.cuda.is_available()))

    def log(self, message):
        print(json.dumps({"type": "log", "message": message}), flush=True)

    def separate_stems(self, file_path):
        try:
            if not self.separator:
                self.log("Loading AI Separation Model (MDX-Net)...")
                self.separator = Separator(
                    output_dir=self.output_dir,
                    model_name='UVR-MDX-NET-Voc_FT', # Optimized for 4GB VRAM
                    use_cuda=torch.cuda.is_available()
                )
            
            self.log(f"Starting de-mix for: {os.path.basename(file_path)}")
            output_files = self.separator.separate(file_path)
            
            # Map output files to known stem types
            # Note: audio-separator returns a list of paths
            result = {
                "vocals": None,
                "instrumental": None
            }
            for f in output_files:
                if "Vocals" in f: result["vocals"] = f
                if "Instrumental" in f: result["instrumental"] = f
            
            return {"success": True, "stems": result}
        except Exception as e:
            return {"success": False, "error": str(e), "trace": traceback.format_exc()}

    def pitch_vocals(self, file_path, semi_tones, formant_preserve=True):
        try:
            # Load vocal stem
            data, samplerate = sf.read(file_path)
            
            # Create Pedalboard with Rubberband-powered PitchShift
            # Note: Pedalboard PitchShift is high quality, but we may need 
            # to adjust parameters for specific formant preservation if exposed in future versions.
            board = Pedalboard([
                PitchShift(semitones=semi_tones)
            ])
            
            processed = board(data, samplerate)
            
            # Save processed version
            output_path = file_path.replace(".wav", "_pitched.wav")
            sf.write(output_path, processed, samplerate)
            
            return {"success": True, "output": output_path}
        except Exception as e:
            return {"success": False, "error": str(e)}

engine = StudioEngine()

# Main Loop: Listen for JSON commands on stdin
for line in sys.stdin:
    try:
        command = json.loads(line.strip())
        cmd_type = command.get("command")
        
        if cmd_type == "separate":
            res = engine.separate_stems(command.get("path"))
            print(json.dumps({"type": "response", "id": command.get("id"), "data": res}), flush=True)
            
        elif cmd_type == "pitch":
            res = engine.pitch_vocals(
                command.get("path"), 
                command.get("semitones", 0)
            )
            print(json.dumps({"type": "response", "id": command.get("id"), "data": res}), flush=True)
            
        elif cmd_type == "ping":
            print(json.dumps({"type": "response", "id": command.get("id"), "data": "pong"}), flush=True)

    except Exception as e:
        print(json.dumps({"type": "error", "message": str(e)}), flush=True)

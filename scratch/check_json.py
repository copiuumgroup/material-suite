import json

def find_duplicates(obj, path=''):
    if isinstance(obj, dict):
        keys = set()
        for key in obj.keys():
            if key in keys:
                print(f"Duplicate key found: {path}.{key}")
            keys.add(key)
            find_duplicates(obj[key], f"{path}.{key}")
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            find_duplicates(item, f"{path}[{i}]")

try:
    with open('package.json', 'r') as f:
        # json.load doesn't report duplicate keys by default, it just overwrites.
        # To find them, we can use a custom object_pairs_hook
        def hook(pairs):
            d = {}
            for k, v in pairs:
                if k in d:
                    print(f"Duplicate key: {k}")
                d[k] = v
            return d
        
        json.loads(f.read(), object_pairs_hook=hook)
except Exception as e:
    print(f"Error: {e}")

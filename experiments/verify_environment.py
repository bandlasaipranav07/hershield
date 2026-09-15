import sys

def verify():
    print(f'Python: {sys.version}')
    
    packages = [
        ('NumPy', 'numpy'),
        ('SciPy', 'scipy'),
        ('pandas', 'pandas'),
        ('scikit-learn', 'sklearn'),
        ('soundfile', 'soundfile'),
        ('librosa', 'librosa'),
        ('PyTorch', 'torch'),
        ('torchaudio', 'torchaudio'),
        ('ONNX', 'onnx'),
        ('ONNX Runtime', 'onnxruntime'),
    ]
    
    all_ok = True
    for display_name, module_name in packages:
        try:
            mod = __import__(module_name)
            ver = getattr(mod, '__version__', 'unknown')
            print(f'PASS: {display_name} (version {ver})')
        except Exception as e:
            all_ok = False
            print(f'FAIL: {display_name} - {e}')
            
    if all_ok:
        print('\nAll Phase 1 ML experimentation dependencies verified successfully.')
    else:
        print('\nSome dependencies failed verification.')
        sys.exit(1)

if __name__ == '__main__':
    verify()

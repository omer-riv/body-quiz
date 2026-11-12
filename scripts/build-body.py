#!/usr/bin/env python3
"""Builds the 3D body in public/body/ from BodyParts3D.

    pip install numpy trimesh fast-simplification
    npm run build-body

The source is BodyParts3D 3.0 (c) The Database Center for Life Science, licensed
under CC Attribution-Share Alike 2.1 Japan: 937 STL files, 26 million triangles,
1.3 GB. They are fetched once into .cache/ from a GitHub mirror. Each part is
simplified to about 4% of its triangles, turned to Y-up, and its positions are
stored as 16-bit integers over the whole body's bounding box. The parts of one
layer share a file, so the game can load the body layer by layer:

    public/body/manifest.json   the box, and every part: id, name, layer, kind, where its data is
    public/body/<layer>.bin     per part: positions (uint16 x3), then indices (uint16 or uint32)
"""
import csv, json, os, re, subprocess, sys
from multiprocessing import Pool
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '.cache', 'BodyParts3D')
DATA = os.path.join(SRC, 'assets', 'BodyParts3D_data')
OUT = os.path.join(ROOT, 'public', 'body')
MIRROR = 'https://github.com/Kevin-Mattheus-Moerman/BodyParts3D'
LAYERS = ['skin', 'muscle', 'bone', 'organ', 'vessel', 'brain']
KEEP = 0.04        # the share of triangles kept
MIN_TRIANGLES = 400  # small parts keep their shape

# A part's kind, from the FMA classes above it (FMA.csv is the is-a tree)...
BY_CLASS = [
    ('skin', r'^Skin|Integument'),
    ('bone', r'Bone organ|^Tooth$|Cartilage organ|Skeletal ligament|Intervertebral dis[ck]|^Bone$|^Cartilage'),
    ('muscle', r'Muscle organ|^Tendon|Muscle$|^Fascia'),
    ('artery', r'^Artery$|Arterial|^Aorta'),
    ('vein', r'^Vein$|Venous|Vena cava|^Sinus of dura'),
    ('brain', r'Nerve|Neural|Brain|Gyrus|Spinal cord|Ganglion|Segment of neuraxis|Cerebr|Region of .*cortex|plexus'),
]
# ...and from its name, which wins: the classes miss or misplace these.
BY_NAME = [
    ('organ', r'papillary muscle|^ear$|labial part of mouth'),
    ('skin', r'hairs|eyebrows'),
    ('muscle', r'calcaneal tendon|plantar ligament|pectoralis|deltoid|digastric|trapezius|flexor|extensor|masseter|pronator|longus colli|gastrocnemius|triceps|biceps|pterygoid|adductor|coccygeus|puborectalis|interosse(i|ous of)|intertransvers|interspinales|levatores|lumbricals|spinalis|frontalis|occipitalis|orbicularis|temporoparietalis|aponeurosis|iliotibial|linea alba|retinaculum|inguinal ligament|interosseous membrane'),
    ('bone', r'sternum|manubrium|xiphoid|sacrum|costal cartilage|nasal cartilages'),
    ('artery', r'aorta|artery'),
    ('vein', r'\bveins?\b|vena cava|coronary sinus'),
    ('brain', r'gyrus|gyri|lobule|commissure|capsule|colliculus|caudate|cerebellum|callosum|pallidus|habenula|hypothalamus|interpeduncular|interventricular foramen|lamina terminalis|geniculate|mammillary|pineal|pituitary|pons|putamen|pellucidum|stria |thalamus|tuber cinereum|insula|ventricle$|aqueduct|amygdala|hippocampus|optic|midbrain|medulla|fornix|white matter|occipital lobe|spinal cord'),
]


def fetch():
    if os.path.isdir(os.path.join(DATA, 'stl')):
        return
    os.makedirs(os.path.dirname(SRC), exist_ok=True)
    subprocess.run(['git', 'clone', '--depth', '1', '--filter=blob:none', '--no-checkout', MIRROR, SRC], check=True)
    subprocess.run(['git', 'sparse-checkout', 'set', '--no-cone', '/assets/BodyParts3D_data/*.txt', '/assets/BodyParts3D_data/*.csv', '*.stl'], cwd=SRC, check=True)
    subprocess.run(['git', 'checkout'], cwd=SRC, check=True)


def classify():
    names = {}
    for line in open(os.path.join(DATA, 'parts_list_e.txt')).read().splitlines()[1:]:
        key, name = line.split('\t')
        names[key.strip('"')] = name
    label, parent = {}, {}
    for row in csv.reader(open(os.path.join(DATA, 'FMA.csv'))):
        label[row[0]], parent[row[0]] = row[1], row[2]

    def classes(part):
        out, at = [], part[3:] if part.startswith('FMA') else ''
        while at in label and len(out) < 50:
            out.append(label[at])
            at = parent.get(at, '')
        return out

    def kind(part, name):
        for k, rx in BY_NAME:
            if re.search(rx, name):
                return k
        chain = classes(part)
        for k, rx in BY_CLASS:
            if any(re.search(rx, c) for c in chain):
                return k
        return 'organ'

    parts = []
    for f in sorted(os.listdir(os.path.join(DATA, 'stl'))):
        part = f[:-4]
        name = names[part]
        if 'pubic hairs' in name:  # a spiky blob that helps nobody
            continue
        k = kind(part, name)
        layer = 'vessel' if k in ('artery', 'vein') else k
        parts.append({'id': part, 'name': name, 'layer': layer, 'kind': k})
    return parts


def simplify(part):
    import trimesh, fast_simplification
    mesh = trimesh.load(os.path.join(DATA, 'stl', part['id'] + '.stl'), process=True)
    v = np.asarray(mesh.vertices, np.float32)
    f = np.asarray(mesh.faces, np.uint32)
    target = max(MIN_TRIANGLES, int(len(f) * (KEEP * 1.5 if part['layer'] == 'skin' else KEEP)))
    if len(f) > target:
        v, f = fast_simplification.simplify(v, f, target_count=target, agg=5)
    # BodyParts3D is in mm, Z up, facing -Y. The game is Y up, facing +Z.
    v = np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1).astype(np.float32)
    return v, np.asarray(f, np.uint32)


def main():
    fetch()
    parts = classify()
    with Pool() as pool:
        meshes = pool.map(simplify, parts, chunksize=4)
    lo = np.min([v.min(axis=0) for v, _ in meshes], axis=0)
    hi = np.max([v.max(axis=0) for v, _ in meshes], axis=0)
    os.makedirs(OUT, exist_ok=True)
    files = {layer: open(os.path.join(OUT, layer + '.bin'), 'wb') for layer in LAYERS}
    at = {layer: 0 for layer in LAYERS}
    triangles = 0
    for part, (v, f) in zip(parts, meshes):
        q = np.round((v - lo) / (hi - lo) * 65535).astype('<u2')
        wide = len(v) > 65535
        idx = f.astype('<u4' if wide else '<u2')
        out, layer = files[part['layer']], part['layer']
        if wide and at[layer] % 4:  # a Uint32Array must start on a multiple of 4
            out.write(b'\0\0'); at[layer] += 2
        pad = (len(q.tobytes()) % 4) if wide else 0
        part['v'] = [at[layer], len(v)]
        out.write(q.tobytes()); at[layer] += q.nbytes
        if pad:
            out.write(b'\0\0'); at[layer] += 2
        part['f'] = [at[layer], len(f)]
        if wide:
            part['wide'] = True
        out.write(idx.tobytes()); at[layer] += idx.nbytes
        triangles += len(f)
    for out in files.values():
        out.close()
    manifest = {
        'credit': 'BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan',
        'min': [round(float(x), 3) for x in lo], 'size': [round(float(x), 3) for x in hi - lo],
        'layers': {layer: at[layer] for layer in LAYERS}, 'parts': parts,
    }
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), separators=(',', ':'))
    print(f'{len(parts)} parts, {triangles} triangles')
    for layer in LAYERS:
        print(f'  {layer}: {at[layer] / 1e6:.1f} MB, {sum(p["layer"] == layer for p in parts)} parts')


if __name__ == '__main__':
    sys.exit(main())

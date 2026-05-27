import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const file = path.join(root, 'features/system-interface/interface-pagination/dock/pageNavigation.js');
const spec = '../../../interface-platform-input/navigation/playNavigationSound.js';
const resolved = path.normalize(path.join(path.dirname(file), spec));
console.log('resolved', resolved);
console.log('exists', fs.existsSync(resolved), fs.existsSync(resolved + '.js'));

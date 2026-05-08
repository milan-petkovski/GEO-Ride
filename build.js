const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app.js');
const token = process.env.MAPBOX_TOKEN;

if (!token) {
    console.error('Error: MAPBOX_TOKEN environment variable is not set.');
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');
const placeholder = '%%MAPBOX_TOKEN%%';

if (content.includes(placeholder)) {
    content = content.replace(new RegExp(placeholder, 'g'), token);
    fs.writeFileSync(filePath, content);
    console.log('Successfully injected MAPBOX_TOKEN into app.js');
} else {
    console.log('Placeholder %%MAPBOX_TOKEN%% not found in app.js (it might have been already replaced)');
}

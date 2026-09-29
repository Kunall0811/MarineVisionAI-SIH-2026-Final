const PDFDocument = require('pdfkit');

function testPdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.text('Hello World');
    doc.end();
  });
}

testPdf()
  .then((buf) => console.log('SUCCESS! Buffer size:', buf.length))
  .catch((err) => console.error('ERROR:', err));

import http from 'http';

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Discord actif\n');
});

server.listen(PORT, () => {
    console.log(`Serveur HTTP actif sur le port ${PORT}`);
});

export default server;

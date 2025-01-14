import express from "express";
import cassandra, { types } from "cassandra-driver";
import * as http from "http";
import * as WebSocket from "ws";
import {AddressInfo} from "ws";
import Uuid = types.Uuid;

const SCYLLADB_URL = process.env.SCYLLADB_URL || "localhost";

const app = express();
const route = express.Router();

const server = http.createServer(app)

const wss = new WebSocket.Server({ server });
wss.on('connection', (ws: WebSocket) => {

    const extWs = ws as ExtWebSocket;

    extWs.isAlive = true;

    ws.on('pong', () => {
        extWs.isAlive = true;
    });
});

setInterval(() => {
    wss.clients.forEach((ws) => {
        const extWs = ws as ExtWebSocket;

        if (!extWs.isAlive) return ws.terminate();

        extWs.isAlive = false;
        ws.ping(null, undefined);
    });
}, 10000);

interface ExtWebSocket extends WebSocket {
    isAlive: boolean;
}

enum wsUserActions {
    USER_ADD = "addUser",
    USER_EDIT = "editUser",
    USER_DELETE = "deleteUser",

}
interface wsUserData {
    action: wsUserActions;
    data: User
}

interface User {
    id: Uuid | string,
    name?: string
}

app.use("/static", express.static("static"));
app.use(express.json());

route.post("/api/insert", async (req, res) => {
    const data: User = req.body as User;
    data.id = Uuid.random();

    const client = new cassandra.Client({
        contactPoints: [`${SCYLLADB_URL}:9042`],
        localDataCenter: "datacenter1",
        keyspace: 'local'
    });

    const query = "INSERT INTO users (id, name) VALUES (?, ?);";
    await client.execute(query, [ data.id, data.name ]);

    const wsData: wsUserData = {
        action: wsUserActions.USER_ADD,
        data
    };

    wss.clients.forEach((client) => client.send(JSON.stringify(wsData)));

    res.json({
        "message": "ok",
        "error": false,
        data
    });
});

route.post("/api/delete", async (req, res) => {
    let { id }: User = req.body as User;
    id = Uuid.fromString(id as string);

    const client = new cassandra.Client({
        contactPoints: [`${SCYLLADB_URL}:9042`],
        localDataCenter: "datacenter1",
        keyspace: 'local'
    });

    let query = "SELECT id FROM users WHERE id = ?";
    const { rowLength } = await client.execute(query, [ id ]);

    if (!rowLength) res.json({
        "message": "User not found",
        "error": true,
        data: null
    });

    query = "DELETE FROM users WHERE id = ?";
    await client.execute(query, [ id ]);

    const wsData: wsUserData = {
        action: wsUserActions.USER_DELETE,
        data: { id }
    };

    wss.clients.forEach((client) => client.send(JSON.stringify(wsData)));

    res.json({
        "message": "ok",
        "error": false,
        data: { id }
    });
});

route.post("/api/update", async (req, res) => {
    const data: User = req.body as User;

    data.id = Uuid.fromString(data.id as string);

    const client = new cassandra.Client({
        contactPoints: [`${SCYLLADB_URL}:9042`],
        localDataCenter: "datacenter1",
        keyspace: 'local'
    });

    let query = "SELECT id FROM users WHERE id = ?";
    const { rowLength } = await client.execute(query, [ data.id ]);

    if (!rowLength) res.json({
        "message": "User not found",
        "error": true,
        data: null
    });

    query = "UPDATE users SET name = ? WHERE id = ?";
    await client.execute(query, [ data.name, data.id ]);

    const wsData: wsUserData = {
        action: wsUserActions.USER_EDIT,
        data
    };

    wss.clients.forEach((client) => client.send(JSON.stringify(wsData)));

    res.json({
        "message": "ok",
        "error": false,
        data
    });
});

route.get("/api/getAll", async (req, res) => {
    const client = new cassandra.Client({
        contactPoints: [`${SCYLLADB_URL}:9042`],
        localDataCenter: "datacenter1",
        keyspace: 'local'
    });

    const query = "SELECT id, name FROM users";
    const { rows } = await client.execute(query);

    res.json({
        "message": "ok",
        "error": false,
        data: rows
    });
});

app.use(route);

server.listen(8080, () => {
    const _address = server.address() as AddressInfo;

    console.log(`Server started on http://localhost:${_address.port}`);
});
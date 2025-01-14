"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cassandra_driver_1 = __importStar(require("cassandra-driver"));
const http = __importStar(require("http"));
const WebSocket = __importStar(require("ws"));
var Uuid = cassandra_driver_1.types.Uuid;
const SCYLLADB_URL = process.env.SCYLLADB_URL || "localhost";
const app = (0, express_1.default)();
const route = express_1.default.Router();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
    const extWs = ws;
    extWs.isAlive = true;
    ws.on('pong', () => {
        extWs.isAlive = true;
    });
});
setInterval(() => {
    wss.clients.forEach((ws) => {
        const extWs = ws;
        if (!extWs.isAlive)
            return ws.terminate();
        extWs.isAlive = false;
        ws.ping(null, undefined);
    });
}, 10000);
var wsUserActions;
(function (wsUserActions) {
    wsUserActions["USER_ADD"] = "addUser";
    wsUserActions["USER_EDIT"] = "editUser";
    wsUserActions["USER_DELETE"] = "deleteUser";
})(wsUserActions || (wsUserActions = {}));
app.use("/static", express_1.default.static("static"));
app.use(express_1.default.json());
route.post("/api/insert", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = req.body;
    data.id = Uuid.random();
    const client = new cassandra_driver_1.default.Client({
        contactPoints: [`${SCYLLADB_URL}:9042`],
        localDataCenter: "datacenter1",
        keyspace: 'local'
    });
    const query = "INSERT INTO users (id, name) VALUES (?, ?);";
    yield client.execute(query, [data.id, data.name]);
    const wsData = {
        action: wsUserActions.USER_ADD,
        data
    };
    wss.clients.forEach((client) => client.send(JSON.stringify(wsData)));
    res.json({
        "message": "ok",
        "error": false,
        data
    });
}));
route.post("/api/delete", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let { id } = req.body;
    id = Uuid.fromString(id);
    const client = new cassandra_driver_1.default.Client({
        contactPoints: [`${SCYLLADB_URL}:9042`],
        localDataCenter: "datacenter1",
        keyspace: 'local'
    });
    let query = "SELECT id FROM users WHERE id = ?";
    const { rowLength } = yield client.execute(query, [id]);
    if (!rowLength)
        res.json({
            "message": "User not found",
            "error": true,
            data: null
        });
    query = "DELETE FROM users WHERE id = ?";
    yield client.execute(query, [id]);
    const wsData = {
        action: wsUserActions.USER_DELETE,
        data: { id }
    };
    wss.clients.forEach((client) => client.send(JSON.stringify(wsData)));
    res.json({
        "message": "ok",
        "error": false,
        data: { id }
    });
}));
route.post("/api/update", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = req.body;
    data.id = Uuid.fromString(data.id);
    const client = new cassandra_driver_1.default.Client({
        contactPoints: [`${SCYLLADB_URL}:9042`],
        localDataCenter: "datacenter1",
        keyspace: 'local'
    });
    let query = "SELECT id FROM users WHERE id = ?";
    const { rowLength } = yield client.execute(query, [data.id]);
    if (!rowLength)
        res.json({
            "message": "User not found",
            "error": true,
            data: null
        });
    query = "UPDATE users SET name = ? WHERE id = ?";
    yield client.execute(query, [data.name, data.id]);
    const wsData = {
        action: wsUserActions.USER_EDIT,
        data
    };
    wss.clients.forEach((client) => client.send(JSON.stringify(wsData)));
    res.json({
        "message": "ok",
        "error": false,
        data
    });
}));
route.get("/api/getAll", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new cassandra_driver_1.default.Client({
        contactPoints: [`${SCYLLADB_URL}:9042`],
        localDataCenter: "datacenter1",
        keyspace: 'local'
    });
    const query = "SELECT id, name FROM users";
    const { rows } = yield client.execute(query);
    res.json({
        "message": "ok",
        "error": false,
        data: rows
    });
}));
app.use(route);
server.listen(8080, () => {
    const _address = server.address();
    console.log(`Server started on http://localhost:${_address.port}`);
});

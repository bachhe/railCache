import { Database } from "bun:sqlite";

export const db = new Database("trains.sqlite");

db.exec("PRAGMA journal_mode=WAL;");

db.exec("PRAGMA synchronous=NORMAL;");

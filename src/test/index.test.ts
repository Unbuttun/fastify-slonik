/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { config } from "dotenv";
import Fastify from "fastify";
import { sql } from "slonik";
import { test } from "tap";
import fastifySlonik from "../index";

config();

const user = process.env.POSTGRES_USER as string;
const password = process.env.POSTGRES_PASSWORD as string;
const hostname = process.env.POSTGRES_HOST as string;
const db = process.env.POSTGRES_DB as string;
const port = process.env.PORT as string;

const DATABASE_URL = process.env.DATABASE_URL as string;

console.log(
  "Connection string",
  DATABASE_URL,
  user,
  password,
  hostname,
  db,
  port
);

const BAD_DB_NAME = "db_that_does_not_exist";
const connectionStringBadDbName = DATABASE_URL.replace(
  /\/[^/]+$/,
  `/${BAD_DB_NAME}`
);

declare module "fastify" {
  interface FastifyInstance {
    slonik: any;
    sql: typeof sql;
  }
}

const main = async () => {
  try {
    await test("Namespace should exist:", async (tap) => {
      const fastify = Fastify();

      // @ts-ignore
      tap.teardown(() => fastify.close());

      await fastify.register(fastifySlonik, {
        connectionString: DATABASE_URL,
        queryLogging: true,
      });
      await fastify.ready();

      tap.ok(fastify.hasDecorator("slonik"), "has slonik decorator");
      tap.ok(fastify.slonik.pool);
      tap.ok(fastify.slonik.connect);
      tap.ok(fastify.slonik.query);
      tap.ok(fastify.slonik.transaction);
      tap.ok(fastify.slonik.exists);
      tap.ok(fastify.hasDecorator("sql"), "has sql decorator");
    });
  } catch (err) {
    console.log("Namespace should exist failed");
    throw new Error(err);
  }

  try {
    await test("When fastify.slonik root namespace is used:", async (t) => {
      const testName = "foobar";

      const fastify = Fastify();

      t.teardown(async () => {
        const addTable = fastify.sql`
        CREATE TABLE IF NOT EXISTS users(
          id serial PRIMARY KEY,
          username VARCHAR (50) NOT NULL
        );
        `;
        await fastify.slonik.transaction(addTable);
        await fastify.close();
      });

      t.teardown(async () => {
        const removeUser = fastify.sql`
        DELETE FROM
          users
        WHERE
          username=${testName};
      `;
        await fastify.slonik.transaction(removeUser);
        await fastify.close();
      });

      await fastify.register(fastifySlonik, { connectionString: DATABASE_URL });
      await fastify.ready();

      await t.test("should be able to make a query", async (t0) => {
        const queryString = fastify.sql`
        SELECT 1 as one
      `;
        const queryResult = await fastify.slonik.query(queryString);
        const {
          rows: [{ one }],
        } = queryResult;
        t0.equal(one, 1);
      });

      await t.test("should be able to make a transaction", async (t1) => {
        const queryString = fastify.sql`
        INSERT INTO
          users(username)
        VALUES
          (${testName})
        RETURNING
          *;
      `;
        const queryResult = await fastify.slonik.transaction(queryString);
        const {
          rows: [{ username }],
        } = queryResult;
        t1.equal(username, testName);
      });

      await t.test("should be able to make a exists query", async (t2) => {
        const queryString = fastify.sql`
        SELECT
          1
        FROM
          users
        WHERE
          username=${testName}
      `;
        const queryResult = await fastify.slonik.exists(queryString);
        t2.ok(queryResult);
      });
    });
  } catch (err) {
    console.log("When fastify.slonik root namespace is used: Failed");
    throw new Error(err);
  }

  try {
    await test("should throw error when pg fails to perform an operation", async (t) => {
      const fastify = Fastify();
      // @ts-ignore
      t.teardown(() => fastify.close());

      await fastify.register(fastifySlonik, {
        connectionString: connectionStringBadDbName,
      });

      await fastify.ready();

      const queryString = fastify.sql`
      SELECT 1 as one
    `;

      try {
        const queryResult = await fastify.slonik.query(queryString);
        t.fail(queryResult);
      } catch (err) {
        t.ok(err);
        if (
          err.message === `FATAL:  database "${BAD_DB_NAME}" does not exist`
        ) {
          t.ok(err.message);
        }
      }
    });
  } catch (err) {
    console.log(
      "should throw error when pg fails to perform an operation: Failed"
    );
    throw new Error(err);
  }
};

main().catch((err) => console.log(err));

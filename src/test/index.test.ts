/* eslint-disable import/order */
/* eslint-disable promise/prefer-await-to-callbacks */
/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from "dotenv";
import fastify from "fastify";
import type { sql } from "slonik";
import { test } from "tap";
import fastifySlonik from "..";

config();

const DATABASE_URL = process.env.DATABASE_URL as string;
const BAD_DB_NAME = "db_that_does_not_exist";
const connectionStringBadDbName = DATABASE_URL.replace(
  /\/[^/]+$/u,
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
      const app = fastify();

      tap.teardown(() => app.close());

      await app.register(fastifySlonik, {
        connectionString: DATABASE_URL,
      });
      await app.ready();

      tap.ok(app.hasDecorator("slonik"), "has slonik decorator");
      tap.ok(app.slonik.pool);
      tap.ok(app.slonik.connect);
      tap.ok(app.slonik.query);
      tap.ok(app.hasDecorator("sql"), "has sql decorator");
    });
  } catch (error) {
    console.log("Namespace should exist failed");
    throw new Error(error as string);
  }

  try {
    await test("When fastify.slonik root namespace is used:", async (t) => {
      const testName = "foobar";

      const app = fastify();

      t.teardown(async () => {
        const removeUser = app.sql`
        DELETE FROM
          users
        WHERE
          username=${testName};
      `;
        await app.slonik.query(removeUser);
        await app.close();
      });

      await app.register(fastifySlonik, { connectionString: DATABASE_URL });
      await app.ready();

      await t.test("should be able to make a query", async (t0) => {
        const queryString = app.sql`
        SELECT 1 as one
      `;
        const queryResult = await app.slonik.query(queryString);
        const {
          rows: [{ one }],
        } = queryResult;
        t0.equal(one, 1);
      });
    });
  } catch (error) {
    console.log("When fastify.slonik root namespace is used: Failed");
    throw new Error(error as string);
  }

  try {
    await test("should throw error when pg fails to perform an operation", async (t) => {
      const app = fastify();
      t.teardown(() => app.close());

      await app.register(fastifySlonik, {
        connectionString: connectionStringBadDbName,
      });

      await app.ready();

      const queryString = app.sql`
      SELECT 1 as one
    `;

      try {
        const queryResult = await app.slonik.query(queryString);
        t.fail(queryResult);
      } catch (error: any) {
        t.ok(error);
        if (
          error.message === `FATAL:  database "${BAD_DB_NAME}" does not exist`
        ) {
          t.ok(error.message);
        }
      }
    });
  } catch (error) {
    console.log(
      "should throw error when pg fails to perform an operation: Failed"
    );
    throw new Error(error as string);
  }
};

main().catch((error) => {
  console.log(error);
});

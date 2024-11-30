import { Hono } from "@hono/hono";

const app = new Hono();
const kv = await Deno.openKv();

interface Task {
  id: string;
  name: string;
  done: boolean;
  priority: number;
}

app.post("/task", async (c) => {
  const { name, priority } = await c.req.json();
  const id = crypto.randomUUID();
  const task: Task = { id, name, done: false, priority };
  await kv.set(["task", id], task);
  return c.json({
    message: `Task ${name} has been added to the list!`,
  });
});

app.get("/task", async (c) => {
  const task = await Array.fromAsync(kv.list({ prefix: ["task"] }));
  return c.json(task.map((task) => task.value));
});

app.get("/task/:id", async (c) => {
  const id = c.req.param("id");
  const task = await kv.get(["task", id]);
  if (task.value !== null) {
    return c.json({ message: "Task not found" }, 404);
  }
  return c.json(task.value);
});

app.delete("/task/:id", async (c) => {
  const id = c.req.param("id");
  const task = await kv.get(["task", id]);
  if (task.value !== null) {
    console.log(task.value);
    await kv.delete(["task", id]);
    return c.json({
      message: `Task has been deleted!`,
    });
  }
  return c.json({ message: "Task not found" }, 404);
});

app.put("/task/:id", async (c) => {
  const id = c.req.param("id");
  const { name, done, priority } = await c.req.json();
  const updatedTask: Task = { id, name, done, priority };
  await kv.set(["task", id], updatedTask);
  return c.json({
    message: `Task updated!`,
  });
});

Deno.serve(app.fetch);

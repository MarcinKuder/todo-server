import { Hono } from "@hono/hono";

const app = new Hono();
const kv = await Deno.openKv();

interface Task {
  id: string;
  name: string;
  done: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

app.post("/task", async (c) => {
  try {
    let { name, priority } = await c.req.json();
    if (
      typeof name !== "string" ||
      (priority != null && typeof priority !== "number")
    ) {
      throw new Error("Invalid request data");
    }
    if (priority == null) {
      priority = 1;
    }
    const id = crypto.randomUUID();
    const task: Task = {
      id,
      name,
      done: false,
      priority,
      createdAt: new Date().toISOString(),
    };
    await kv.set(["task", id], task);
    return c.json({
      message: `Task "${name}" has been added to the list!`,
    });
  } catch (e: any) {
    return c.json({ message: `Invalid request data. ${e.message}` }, 400);
  }
});

app.get("/task", async (c) => {
  const task: Deno.KvEntry<Task>[] = await Array.fromAsync(
    kv.list({ prefix: ["task"] }),
  );
  const hideDone = c.req.query("hideDone") === "true";
  return c.json(
    task
      .filter((task) => !hideDone || !task.value.done)
      .map((task) => task.value),
  );
});

app.get("/task/:id", async (c) => {
  const id = c.req.param("id");
  const task = await kv.get(["task", id]);
  if (task.value === null) {
    return c.json({ message: "Task not found" }, 404);
  }
  return c.json(task.value);
});

app.delete("/task/:id", async (c) => {
  const id = c.req.param("id");
  const task = await kv.get(["task", id]);
  if (task.value !== null) {
    await kv.delete(["task", id]);
    return c.json({
      message: `Task has been deleted!`,
    });
  }
  return c.json({ message: "Task not found" }, 404);
});

app.delete("/deleteAll", async (c) => {
  const tasks: Deno.KvListIterator<Task> = kv.list({ prefix: ["task"] });
  for await (const task of tasks) {
    await kv.delete(["task", task.value.id]);
  }
  return c.json({ message: "All tasks have been deleted!" });
});

app.put("/task/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { name, done, priority } = await c.req.json();
    let updatedTask = (await kv.get(["task", id])).value as Task;
    if (name !== undefined) {
        updatedTask.name = name;
    }
    if (done !== undefined) {
        updatedTask.done = done;
    }
    if (priority !== undefined) {
        updatedTask.priority = priority;
    }
    updatedTask.updatedAt = new Date().toISOString();
    await kv.set(["task", id], updatedTask);
    return c.json({ message: `Task updated!` });
  } catch (e: any) {
    return c.json({ message: `Error: ${e.message}` }, 400);
  }
});

Deno.serve(app.fetch);

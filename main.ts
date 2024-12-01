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

app.post("/tasks", async (c) => {
  try {
    let { name, priority } = await c.req.json();
    if (typeof name !== "string") {
      throw new Error("Name is required");
    }
    const task: Task = {
      id: crypto.randomUUID(),
      name,
      done: false,
      priority: priority || 1,
      createdAt: new Date().toISOString(),
    };
    await kv.set(["tasks", id], task);
    return c.json({
      message: `Task "${name}" has been added to the list!`,
    });
  } catch (e: any) {
    return c.json({ message: `Error: ${e.message}` }, 400);
  }
});

app.get("/tasks", async (c) => {
  const tasks: Deno.KvEntry<Task>[] = await Array.fromAsync(
    kv.list({ prefix: ["tasks"] }),
  );
  const hideDone = c.req.query("hideDone") === "true";
  return c.json(
    tasks
      .filter((task) => !hideDone || !task.value.done)
      .map((task) => task.value),
  );
});

app.get("/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const task = await kv.get(["tasks", id]);
  if (task.value === null) {
    return c.json({ message: "Task not found" }, 404);
  }
  return c.json(task.value);
});

app.delete("/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const task = await kv.get(["tasks", id]);
  if (task.value !== null) {
    await kv.delete(["tasks", id]);
    return c.json({
      message: `Task has been deleted!`,
    });
  }
  return c.json({ message: "Task not found" }, 404);
});

app.delete("/tasks", async (c) => {
  const tasks: Deno.KvListIterator<Task> = kv.list({ prefix: ["tasks"] });
  const authorized = c.req.query("key") === "1111";
  if (!authorized) {
    return c.json({ message: "Unauthorized" }, 401);
  }
  for await (const task of tasks) {
    await kv.delete(["tasks", task.value.id]);
  }
  return c.json({ message: "All tasks have been deleted!" });
});

app.put("/tasks/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { name, done, priority } = await c.req.json();
    let updatedTask = (await kv.get(["tasks", id])).value as Task;
    if (updatedTask === null) {
        return c.json({ message: "Task not found" }, 404);
    }
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
    await kv.set(["tasks", id], updatedTask);
    return c.json({ message: `Task updated!` });
  } catch (e: any) {
    return c.json({ message: `Error: ${e.message}` }, 400);
  }
});

Deno.serve(app.fetch);

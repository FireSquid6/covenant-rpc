import { and, eq } from "drizzle-orm";
import { Database } from ".";
import { Todo, todosTable, usersTable } from "./schema";
import { randomUUID } from "crypto";

export async function getAllTodosForUser(db: Database, userId: string) {
  return await db
    .select()
    .from(todosTable)
    .where(eq(todosTable.userId, userId));
}

export async function makeTodo(db: Database, userId: string, { text, completed }: {
  text: string,
  completed: boolean,
}): Promise<Todo> {
  const id = randomUUID();

  const todos = await db
    .insert(todosTable)
    .values({
      id,
      userId,
      text,
      completed,
      createdAt: new Date(),
      lastUpdated: new Date(),
    })
    .returning()
  
  return todos[0];
}

export async function updateTodo(db: Database, id: string, { text, completed }: {
  text: string,
  completed: boolean,
}): Promise<Todo> {
  const todos = await db
    .update(todosTable)
    .set({
      text: text,
      completed: completed,
      lastUpdated: new Date(),
    })
    .where(eq(todosTable.id, id))
    .returning()

  return todos[0];
}

export async function deleteTodo(db: Database, id: string) {
  await db
    .delete(todosTable)
    .where(eq(todosTable.id, id));
}


export async function ownsTodo(db: Database, userId: string, todoId: string): Promise<boolean> {
  const todos = await db
    .select()
    .from(todosTable)
    .where(and(
      eq(todosTable.id, todoId),
      eq(todosTable.userId, userId),
    ))

  return todos.length > 0;
}

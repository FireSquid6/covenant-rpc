'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { client, getAuthToken, clearAuthToken } from '@/client/client';

type FilterType = 'all' | 'active' | 'completed';

export default function TodoPage() {
  const router = useRouter();
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  // Check if user is authenticated
  useEffect(() => {
    if (!getAuthToken()) {
      router.push('/login');
    }
  }, [router]);

  /**
   * KEY FEATURE: useListenedQuery automatically refetches when mutations occur
   * that affect the same resources (todos/user/${userId})
   *
   * When createTodo, updateTodo, or deleteTodo mutations run, this query
   * automatically refetches to show the updated data!
   */
  const todos = client.useListenedQuery('getTodos', null);

  // Handle logout
  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };

  // Handle create todo
  const handleCreateTodo = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    const result = await client.mutate('createTodo', {
      title: newTodoTitle,
    });

    if (result.success) {
      setNewTodoTitle('');
      // No need to manually refetch - useListenedQuery does it automatically!
    }
  };

  // Handle toggle completed
  const handleToggleCompleted = async (id: string, completed: boolean) => {
    await client.mutate('updateTodo', {
      id,
      completed: !completed,
    });
    // No need to manually refetch - useListenedQuery does it automatically!
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    await client.mutate('deleteTodo', { id });
    // No need to manually refetch - useListenedQuery does it automatically!
  };

  // Loading state
  if (todos.loading) {
    return (
      <div className="container">
        <div className="loading">Loading todos...</div>
      </div>
    );
  }

  // Error state
  if (todos.error) {
    return (
      <div className="container">
        <div className="error">Error: {todos.error.message}</div>
        <button className="button button-secondary" onClick={handleLogout}>
          Back to Login
        </button>
      </div>
    );
  }

  // Filter todos
  const filteredTodos = todos.data.filter((todo) => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  return (
    <div className="container">
      <div className="header">
        <h1>My Todos</h1>
        <button className="button button-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Create Todo Form */}
      <form className="todo-form" onSubmit={handleCreateTodo}>
        <input
          type="text"
          className="input"
          placeholder="What needs to be done?"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
        />
        <button type="submit" className="button">
          Add
        </button>
      </form>

      {/* Filter Buttons */}
      <div className="filters">
        <button
          className={`filter-button ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({todos.data.length})
        </button>
        <button
          className={`filter-button ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active ({todos.data.filter((t) => !t.completed).length})
        </button>
        <button
          className={`filter-button ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed ({todos.data.filter((t) => t.completed).length})
        </button>
      </div>

      {/* Todo List */}
      {filteredTodos.length === 0 ? (
        <div className="empty-state">
          {filter === 'all'
            ? 'No todos yet. Add one above!'
            : filter === 'active'
            ? 'No active todos'
            : 'No completed todos'}
        </div>
      ) : (
        <ul className="todo-list">
          {filteredTodos.map((todo) => (
            <li
              key={todo.id}
              className={`todo-item ${todo.completed ? 'completed' : ''}`}
            >
              <input
                type="checkbox"
                className="checkbox"
                checked={todo.completed}
                onChange={() => handleToggleCompleted(todo.id, todo.completed)}
              />
              <span className="todo-title">{todo.title}</span>
              <div className="todo-actions">
                <button
                  className="delete-button"
                  onClick={() => handleDelete(todo.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Info about automatic cache invalidation */}
      <div style={{ marginTop: '40px', padding: '20px', background: '#f8f9fa', borderRadius: '4px' }}>
        <h3 style={{ marginBottom: '10px', color: '#667eea' }}>
          Automatic Cache Invalidation
        </h3>
        <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
          This page uses <code>useListenedQuery</code> which automatically refetches
          when mutations occur. When you create, update, or delete a todo, the list
          automatically updates without manual refetch calls. This works through
          resource tracking - mutations and queries declare which resources they
          touch, and Sidekick coordinates automatic invalidation.
        </p>
      </div>
    </div>
  );
}

-- handle_new_user es un trigger, no debe ser invocable como RPC por nadie excepto postgres
revoke execute on function public.handle_new_user() from public, anon, authenticated;

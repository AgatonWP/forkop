import { withSupabase } from 'npm:@supabase/server@^1';

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, context) => {
    if (request.method !== 'DELETE') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const {
      data: { user },
      error: userError,
    } = await context.supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Supabase Auth cannot delete a user who still owns Storage objects.
    const { data: avatarObjects, error: listError } = await context.supabaseAdmin.storage
      .from('avatars')
      .list(user.id, { limit: 1000 });

    if (listError) {
      return Response.json({ error: 'Could not inspect profile files' }, { status: 500 });
    }

    if (avatarObjects && avatarObjects.length > 0) {
      const paths = avatarObjects.map((object) => `${user.id}/${object.name}`);
      const { error: removeError } = await context.supabaseAdmin.storage.from('avatars').remove(paths);

      if (removeError) {
        return Response.json({ error: 'Could not remove profile files' }, { status: 500 });
      }
    }

    const { error: deleteError } = await context.supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      return Response.json({ error: 'Could not delete account' }, { status: 500 });
    }

    return Response.json({ deleted: true });
  }),
};

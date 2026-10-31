// Heritage places: Aksh's researched list of sites, crafts and food spots, each with a map position.
// Editing and verifying go through the shared routes in admin.js (/api/admin/places/...); this file
// only lists them. The public list holds verified places only, like facts.
import { json, err } from './router.js';

export default function places(r, { db }) {
  r.get('/api/cities/:id/places', { cache: 60 }, async ({ params }) => {
    const rows = (await db.query(`SELECT p.id, p.name, p.native_name, p.category, p.subcategory, p.description,
        p.latitude, p.longitude, p.year, p.image_url, p.image_license, p.source_url,
        p.details->>'image_original' AS image_original
      FROM heritage_places p JOIN cities c ON c.id = p.city_id
      WHERE p.city_id = $1 AND c.published AND p.status = 'verified' ORDER BY p.sort_order, p.id`, [params.id])).rows;
    return json(200, { places: rows });
  });

  r.get('/api/admin/cities/:id/places', { role: 'editor' }, async ({ params }) => {
    if (!(await db.query('SELECT 1 FROM cities WHERE id = $1', [params.id])).rows.length) return err(404, 'No such city.');
    const rows = (await db.query(`SELECT x.*, cu.name AS created_by_name, uu.name AS updated_by_name, vu.name AS verified_by_name
      FROM heritage_places x LEFT JOIN users cu ON cu.id = x.created_by LEFT JOIN users uu ON uu.id = x.updated_by
      LEFT JOIN users vu ON vu.id = x.verified_by WHERE x.city_id = $1 ORDER BY x.sort_order, x.id`, [params.id])).rows;
    return json(200, { places: rows });
  });
}

import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';
import { slugify } from '../utils/slugify.js';

export async function getCategories(req, res) {
  try {
    const db = getDb();
    const categoriesCol = db.collection('cms_categories');
    const postsCol = db.collection('cms_posts');

    const categories = await categoriesCol.find({}).sort({ order: 1, name: 1 }).toArray();

    // Dynamically calculate post count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await postsCol.countDocuments({
          $or: [{ categoryId: cat._id }, { category: cat.name }],
        });
        return {
          id: cat._id.toString(),
          name: cat.name,
          slug: cat.slug,
          description: cat.description || '',
          color: cat.color || '#4f46e5',
          order: cat.order || 0,
          postCount: count,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
        };
      })
    );

    return res.status(200).json({ categories: categoriesWithCount });
  } catch (err) {
    console.error('Get Categories Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve categories.', code: 'SERVER_ERROR' });
  }
}

export async function createCategory(req, res) {
  try {
    const { name, slug, description = '', color = '#4f46e5', order = 0 } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: 'Category name is required (minimum 2 characters).',
        code: 'VALIDATION_ERROR',
      });
    }

    const formattedSlug = slug ? slugify(slug) : slugify(name);
    const db = getDb();
    const categoriesCol = db.collection('cms_categories');

    // Check unique name and slug
    const existing = await categoriesCol.findOne({
      $or: [{ name: name.trim() }, { slug: formattedSlug }],
    });

    if (existing) {
      return res.status(409).json({
        error: 'A category with this name or slug already exists.',
        code: 'CATEGORY_ALREADY_EXISTS',
      });
    }

    const newCategory = {
      name: name.trim(),
      slug: formattedSlug,
      description: description.trim(),
      color: color.trim(),
      order: parseInt(order, 10) || 0,
      postCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await categoriesCol.insertOne(newCategory);

    await logAuditEvent({
      req,
      action: 'CATEGORY_CREATED',
      targetType: 'CATEGORY',
      targetId: result.insertedId.toString(),
      targetName: newCategory.name,
      metadata: { slug: newCategory.slug, color: newCategory.color },
    });

    return res.status(201).json({
      message: 'Category created successfully.',
      category: { id: result.insertedId.toString(), ...newCategory },
    });
  } catch (err) {
    console.error('Create Category Error:', err);
    return res.status(500).json({ error: 'Failed to create category.', code: 'SERVER_ERROR' });
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid category ID.', code: 'INVALID_ID' });
    }

    const { name, slug, description, color, order } = req.body || {};
    const db = getDb();
    const categoriesCol = db.collection('cms_categories');

    const category = await categoriesCol.findOne({ _id: new ObjectId(id) });
    if (!category) {
      return res.status(404).json({ error: 'Category not found.', code: 'NOT_FOUND' });
    }

    const updateDoc = { updatedAt: new Date() };
    if (name) updateDoc.name = name.trim();
    if (slug) updateDoc.slug = slugify(slug);
    if (description !== undefined) updateDoc.description = description.trim();
    if (color !== undefined) updateDoc.color = color.trim();
    if (order !== undefined) updateDoc.order = parseInt(order, 10) || 0;

    // Check conflict if name or slug changed
    if (updateDoc.name || updateDoc.slug) {
      const conflict = await categoriesCol.findOne({
        _id: { $ne: new ObjectId(id) },
        $or: [
          ...(updateDoc.name ? [{ name: updateDoc.name }] : []),
          ...(updateDoc.slug ? [{ slug: updateDoc.slug }] : []),
        ],
      });
      if (conflict) {
        return res.status(409).json({
          error: 'A category with this name or slug already exists.',
          code: 'CATEGORY_ALREADY_EXISTS',
        });
      }
    }

    await categoriesCol.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });

    await logAuditEvent({
      req,
      action: 'CATEGORY_UPDATED',
      targetType: 'CATEGORY',
      targetId: id,
      targetName: updateDoc.name || category.name,
      metadata: { updatedFields: Object.keys(updateDoc) },
    });

    return res.status(200).json({
      message: 'Category updated successfully.',
      category: { ...category, ...updateDoc, id },
    });
  } catch (err) {
    console.error('Update Category Error:', err);
    return res.status(500).json({ error: 'Failed to update category.', code: 'SERVER_ERROR' });
  }
}

export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid category ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const categoriesCol = db.collection('cms_categories');
    const postsCol = db.collection('cms_posts');

    const category = await categoriesCol.findOne({ _id: new ObjectId(id) });
    if (!category) {
      return res.status(404).json({ error: 'Category not found.', code: 'NOT_FOUND' });
    }

    // Check if category is used by existing posts
    const postCount = await postsCol.countDocuments({
      $or: [{ categoryId: new ObjectId(id) }, { category: category.name }],
    });

    if (postCount > 0) {
      return res.status(400).json({
        error: `Cannot delete category: ${postCount} article(s) are currently categorized under it. Reassign or delete those articles first.`,
        code: 'CATEGORY_IN_USE',
        postCount,
      });
    }

    await categoriesCol.deleteOne({ _id: new ObjectId(id) });

    await logAuditEvent({
      req,
      action: 'CATEGORY_DELETED',
      targetType: 'CATEGORY',
      targetId: id,
      targetName: category.name,
    });

    return res.status(200).json({ message: 'Category deleted successfully.' });
  } catch (err) {
    console.error('Delete Category Error:', err);
    return res.status(500).json({ error: 'Failed to delete category.', code: 'SERVER_ERROR' });
  }
}

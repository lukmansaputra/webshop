const { Pool } = require("pg");
require("dotenv").config();

class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true }, // Vercel needs this
    });

    this.initializeTables();
  }

  async initializeTables() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,    
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          image TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          price NUMERIC NOT NULL,
          width NUMERIC,
          height NUMERIC,
          weight NUMERIC,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS product_images (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          image_path TEXT NOT NULL
        );
      `);

      await this.pool.query(`
        INSERT INTO categories (name, slug)
        VALUES 
          ('Foods', 'foods'),
          ('Milk', 'milk'),
          ('Others', 'others')
        ON CONFLICT (slug) DO NOTHING;
      `);
    } catch (err) {
      console.error("Database initialization error:", err.message);
    }
  }

  /** ========== CATEGORY CRUD ========== */

  async createCategory({ name, slug, image = null }) {
    try {
      await this.pool.query(
        `INSERT INTO categories (name, slug, image) VALUES ($1, $2, $3)`,
        [name, slug, image]
      );
      return { success: true, message: "Category created successfully." };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async getAllCategories() {
    try {
      const res = await this.pool.query(
        `SELECT * FROM categories ORDER BY name ASC`
      );
      return {
        success: true,
        message: "Categories retrieved successfully.",
        data: res.rows,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async getCategoryById(id) {
    try {
      const res = await this.pool.query(
        `SELECT * FROM categories WHERE id = $1`,
        [id]
      );
      return {
        success: true,
        message: "Category retrieved successfully.",
        data: res.rows[0],
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async updateCategory(id, { name, slug, image = null }) {
    try {
      const res = await this.pool.query(
        `UPDATE categories SET name = $1, slug = $2, image = $3 WHERE id = $4`,
        [name, slug, image, id]
      );
      if (res.rowCount === 0) {
        return {
          success: false,
          message:
            "No category was updated. Maybe the ID does not exist or data is unchanged.",
        };
      }
      return { success: true, message: "Category updated successfully." };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async deleteCategory(id) {
    try {
      await this.pool.query(`DELETE FROM categories WHERE id = $1`, [id]);
      return { success: true, message: "Category deleted successfully." };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  /** ========== PRODUCT CRUD ========== */

  async createProduct({
    category_id,
    name,
    slug,
    description = "",
    price,
    width = null,
    height = null,
    weight = null,
    images = [],
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const insertProductQuery = `
        INSERT INTO products (category_id, name, slug, description, price, width, height, weight)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      const res = await client.query(insertProductQuery, [
        category_id,
        name,
        slug,
        description,
        price,
        width,
        height,
        weight,
      ]);

      const productId = res.rows[0].id;

      if (images.length > 0) {
        const insertImageQuery = `
          INSERT INTO product_images (product_id, image_path) VALUES ($1, $2)
        `;
        for (const img of images) {
          await client.query(insertImageQuery, [productId, img]);
        }
      }

      await client.query("COMMIT");
      return {
        success: true,
        message: "Product and images created successfully.",
        productId,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      return { success: false, message: err.message };
    } finally {
      client.release();
    }
  }

  async getProductById(id) {
    try {
      const query = `
        SELECT products.*, categories.name AS category_name, categories.slug AS category_slug,
        (
          SELECT json_agg(image_path) FROM product_images WHERE product_id = products.id
        ) AS images
        FROM products
        JOIN categories ON products.category_id = categories.id
        WHERE products.id = $1
      `;
      const res = await this.pool.query(query, [id]);
      const row = res.rows[0];
      return {
        success: true,
        message: "Product retrieved successfully.",
        data: row ? { ...row, images: row.images || [] } : null,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async getAllProducts() {
    try {
      const query = `
        SELECT products.*, categories.name AS category_name, categories.slug AS category_slug,
        (
          SELECT json_agg(image_path) FROM product_images WHERE product_id = products.id
        ) AS images
        FROM products
        JOIN categories ON products.category_id = categories.id
        ORDER BY products.created_at DESC
      `;
      const res = await this.pool.query(query);
      return {
        success: true,
        message: "Products retrieved successfully.",
        data: res.rows.map((row) => ({
          ...row,
          images: row.images || [],
        })),
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async updateProduct(
    id,
    {
      category_id,
      name,
      slug,
      description = "",
      price,
      width = null,
      height = null,
      weight = null,
      images = [],
    }
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE products SET category_id = $1, name = $2, slug = $3, description = $4, price = $5, width = $6, height = $7, weight = $8 WHERE id = $9`,
        [category_id, name, slug, description, price, width, height, weight, id]
      );

      const oldRes = await client.query(
        `SELECT image_path FROM product_images WHERE product_id = $1`,
        [id]
      );
      const oldImages = oldRes.rows.map((r) => r.image_path);

      const toDelete = oldImages.filter((img) => !images.includes(img));
      const toInsert = images.filter((img) => !oldImages.includes(img));

      for (const img of toDelete) {
        await client.query(
          `DELETE FROM product_images WHERE product_id = $1 AND image_path = $2`,
          [id, img]
        );
      }

      for (const img of toInsert) {
        await client.query(
          `INSERT INTO product_images (product_id, image_path) VALUES ($1, $2)`,
          [id, img]
        );
      }

      await client.query("COMMIT");
      return { success: true, message: "Product updated successfully." };
    } catch (err) {
      await client.query("ROLLBACK");
      return { success: false, message: err.message };
    } finally {
      client.release();
    }
  }

  async deleteProduct(id) {
    try {
      await this.pool.query(`DELETE FROM products WHERE id = $1`, [id]);
      return { success: true, message: "Product deleted successfully." };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  /** ========== Utility ========== */

  async close() {
    await this.pool.end();
    console.log("✅ DB connection closed.");
  }
}

module.exports = new Database();

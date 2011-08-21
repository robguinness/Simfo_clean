class CreateCategories < ActiveRecord::Migration
  def self.up
    create_table :categories do |t|
      t.string :pluralized_name
      t.references :entity
      t.timestamps
    end

    add_index :categories, :entity_id, :unique => true
  end

  def self.down
    drop_table :categories
  end
end

class AddIndexToRelationshipsOnUpdatedAt < ActiveRecord::Migration
  def self.up
    add_index :relationships, :updated_at
  end

  def self.down
    remove_index :relationships, :updated_at
  end
end

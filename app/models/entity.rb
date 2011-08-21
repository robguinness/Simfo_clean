class Entity < ActiveRecord::Base
  has_one :category, :dependent => :destroy

  has_many :from_relationships, :class_name => 'Relationship', :foreign_key => :from_entity_id
  has_many :to_entities, :through => :from_relationships, :source => :to_entity

  has_many :to_relationships, :class_name => 'Relationship', :foreign_key => :to_entity_id
  has_many :from_entities, :through => :to_relationships, :source => :from_entity

  validates :name, :presence => true, :uniqueness => true

  def orphaned?
    (category.nil? || !category.super_category?) && from_relationships.empty? && to_relationships.empty?
  end
end

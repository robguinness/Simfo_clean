class RelationshipType < ActiveRecord::Base
  has_many :relationships

  validates :name, :presence => true, :uniqueness => true

  module Special
    CategoryMembership = 'is a'
  end

  def categorizes?
    self.name == Special::CategoryMembership
  end

  def orphaned?
    !categorizes? && relationships.empty?
  end
end

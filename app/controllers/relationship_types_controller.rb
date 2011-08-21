class RelationshipTypesController < ApplicationController
  respond_to :json, :xml

  def index
    @relationship_types = RelationshipType.order(:name)

    if params[:_search] == 'true'
      @relationship_types = @relationship_types.
        joins(:relationships).
        joins('INNER JOIN entities AS from_entities ON from_entities.id = relationships.from_entity_id').
        joins('INNER JOIN entities AS to_entities ON to_entities.id = relationships.to_entity_id').
        where(jqgridify_searching).
        group(:name)
    end
    @relationship_types = @relationship_types.page(params[:page] || 1).per(params[:rows] || params[:per_page] || 25)
    respond_with(@relationship_types)
  end

end

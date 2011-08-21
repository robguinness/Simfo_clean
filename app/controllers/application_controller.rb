class ApplicationController < ActionController::Base
  protect_from_forgery
  include SessionsHelper  

  ##
  # jqgridify helper methods
  #
  # NOTE (2011-02-28): Move jqgridify code and tests
  #   to a better place - they don't belong in ApplicationController
  ##

  JqgridifySearchingSimpleOps = {
    'eq' => '=',
    'ne' => '<>',
    'lt' => '<',
    'le' => '<=',
    'gt' => '>',
    'ge' => '>='
  }

  JqgridifySearchingLikeOps = {
    'bw' => [ '?%', true ],
    'bn' => [ '?%', false ],
    'ew' => [ '%?', true ],
    'en' => [ '%?', false ],
    'cn' => [ '%?%', true ],
    'nc' => [ '%?%', false ]
  }

  def jqgridify_ordering(options = nil)
    sidx ||= jqgridify_resolve_column_reference(params[:sidx], options) if params[:sidx]
    return (sidx ? "#{sidx} #{params[:sord]}" : nil)
  end

  def jqgridify_grouping
    (params[:sidx] ? jqgridify_resolve_column_reference(params[:sidx]) : nil)
  end

  def jqgridify_searching
    conditions = nil

    if params[:_search] == 'true' || (params[:filters] && params[:filters]['rules'])
      filters = (params[:filters] ? ActiveSupport::JSON.decode(params[:filters]) : {}) || {}
      # Rails.logger.debug('filters: ' + filters.inspect)
      group_op = filters['groupOp'] || 'AND'
      rules = filters['rules'] || []
      # Rails.logger.debug('rules: ' + rules.inspect)
      exps = rules.map do |r|
        exp, data = jqgridify_searching_rule(r)
        (exp ? [ '(' + exp + ')', data ] : nil)
      end.compact
      conditions = ( [ exps.map { |exp| exp.first }.join(" #{group_op} ") ] +
                     exps.map { |exp| exp.second } )
    end

    # Rails.logger.debug('conditions: ' + conditions.inspect)
    return conditions
  end

  def jqgridify_searching_rule(rule)
    # Rails.logger.debug(rule.inspect)
    column_reference = jqgridify_resolve_column_reference(rule['field'])

    # NOTE (2011-03-30, msiegel): Ensure that all rule components are present
    %w(field op data).each do |component|
      if !rule[component]
        logger.debug("  [!] Rule missing component '#{component}': #{rule.inspect}")
        return nil
      end
    end

    if JqgridifySearchingSimpleOps.include?(rule['op'])
      simple_op = JqgridifySearchingSimpleOps[rule['op']]
      return [ "#{column_reference} #{simple_op} ?", rule['data'] ]
    elsif JqgridifySearchingLikeOps.include?(rule['op'])
      like_op = ( !JqgridifySearchingLikeOps[rule['op']][1] ? 'NOT ' : '' ) + 'LIKE'
      like_val = JqgridifySearchingLikeOps[rule['op']][0].gsub('?', rule['data'].gsub('%', ''))
      JqgridifySearchingLikeOps[rule['op']]
      return [ "#{column_reference} #{like_op} ?", like_val ]
    else
      logger.error("Unknown op in jqgridify_searching_rule: '#{rule['op']}', ignoring")
      return nil
    end
  end

  def jqgridify_resolve_column_reference(field_name, options = nil)
    options ||= {}
    tabelized = field_name.gsub(/(\w+)__/) { |match| "#{$1.pluralize}." }
    resolved =
      if options[:default_table] && !tabelized.include?('.')
        "#{options[:default_table]}.#{tabelized}"
      else
        tabelized
      end
    return resolved
  end

  def jggridify_get_column_reference_from_model(model, column_reference)
    col_refs = (column_reference.is_a?(String) ? column_reference.split('.') : column_reference.clone)
    ref = col_refs.shift
    return model if ref.nil?
    val = (model.respond_to?(ref.to_sym) ? model.send(ref.to_sym) :
           (model.respond_to?(ref.singularize.to_sym) ? model.send(ref.singularize.to_sym) : nil))
    raise RuntimeError, "No attribute '#{ref}'|'#{ref.singularize}' found for #{model.inspect}" if val.nil?
    return jggridify_get_column_reference_from_model(val, col_refs)
  end

  def jqgridify(collection, page, options={})
    rows = collection.map do |r|
      attr_hsh = r.attributes.clone

      if options[:include]
        assoc_attrs = jqgridify_flatten_nested_assoc_names(options[:include])
        assoc_attrs.each do |assoc_attr|
          calls = assoc_attr.split('.')
          value = calls.inject(r) { |obj, meth| (obj.nil? ? nil : obj.send(meth.to_sym)) }
          attr_hsh[assoc_attr] = value
        end

        cols = options[:cols] || attr_hsh.keys.sort
        { :id => r.id, :cell => cols.map { |k| attr_hsh[k] } }
      end

    end

    return {
      'page'    => page,
      'total'   => collection.num_pages,
      'records' => collection.total_count,
      'rows'    => rows
    }
  end

  def jqgridify_flatten_nested_assoc_names(assocs={})
    if assocs.is_a? Hash
      flattened = []
      assocs.each_pair do |key, val|
        recursed_names = jqgridify_flatten_nested_assoc_names(val)
        flattened += recursed_names.map { |name| "#{key}.#{name}" }
      end
      return flattened
    elsif assocs.is_a? Array
      return assocs.map { |name| jqgridify_flatten_nested_assoc_names(name) }
    else
      return assocs.to_s
    end
  end

end

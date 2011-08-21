module SimfoTimeFormatHelper

  def format_time_ago(updated_at, time_now=nil)
    time_now ||= Time.now
    distance_in_seconds = time_now - updated_at

    case distance_in_seconds
    when 0...1
      return "just now"
    when 1...(1.minute)
      plural = (distance_in_seconds.to_i > 1 ? 's' : '')
      return "#{distance_in_seconds.to_i} second#{plural} ago"
    when (1.minute)...(1.hour)
      distance_in_minutes = (distance_in_seconds / (1.minute)).to_i
      plural = (distance_in_minutes > 1 ? 's' : '')
      return "#{distance_in_minutes} minute#{plural} ago"
    when (1.hour)...(1.day)
      distance_in_hours = (distance_in_seconds / (1.hour)).to_i
      plural = (distance_in_hours > 1 ? 's' : '')
      return "#{distance_in_hours} hour#{plural} ago"
    when (1.day)...(1.year)
      return updated_at.strftime("%d %b")
    else
      return updated_at.strftime("%d %b %y")
    end
  end

end
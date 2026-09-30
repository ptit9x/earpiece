#!/bin/bash

# Default values
CLI_IC_DEV=false
CLI_IC_FIREFOX=false

validate_is_boolean() {
  if [[ "$1" != "true" && "$1" != "false" ]]; then
    echo "Invalid value for <$2>. Please use 'true' or 'false'."
    exit 1
  fi
}

# Validate if a key starts with CLI_IC_ or IC_
validate_key() {
  local key="$1"
  local is_editable_section="${2:-false}"

  if [[ -n "$key" && ! "$key" =~ ^# ]]; then
    if [[ "$is_editable_section" == true && ! "$key" =~ ^IC_ ]]; then
      echo "Invalid key: <$key>. All keys in the editable section must start with 'IC_'."
      exit 1
    elif [[ "$is_editable_section" == false && ! "$key" =~ ^CLI_IC_ ]]; then
      echo "Invalid key: <$key>. All CLI keys must start with 'CLI_IC_'."
      exit 1
    fi
  fi
}

parse_arguments() {
  for arg in "$@"
  do
    key="${arg%%=*}"
    value="${arg#*=}"

    validate_key "$key"

    case $key in
      CLI_IC_DEV)
        CLI_IC_DEV="$value"
        validate_is_boolean "$CLI_IC_DEV" "CLI_IC_DEV"
        ;;
      CLI_IC_FIREFOX)
        CLI_IC_FIREFOX="$value"
        validate_is_boolean "$CLI_IC_FIREFOX" "CLI_IC_FIREFOX"
        ;;
      *)
        cli_values+=("$key=$value")
        ;;
    esac
  done
}

# Validate keys in .env file
validate_env_keys() {
  editable_section_starts=false

  while IFS= read -r line; do
    key="${line%%=*}"
    if [[ "$key" =~ ^CLI_IC_ ]]; then
      editable_section_starts=true
    elif $editable_section_starts; then
      validate_key "$key" true
    fi
  done < .env
}

create_new_file() {
  temp_file=$(mktemp)

  {
    echo "# THOSE VALUES ARE EDITABLE ONLY VIA CLI"
    echo "CLI_IC_DEV=$CLI_IC_DEV"
    echo "CLI_IC_FIREFOX=$CLI_IC_FIREFOX"
    for value in "${cli_values[@]}"; do
      echo "$value"
    done
    echo ""
    echo "# THOSE VALUES ARE EDITABLE"

    # Copy existing env values, without CLI section
    grep -E '^IC_' .env
  } > "$temp_file"

  mv "$temp_file" .env
}

# Main script execution
parse_arguments "$@"
validate_env_keys
create_new_file

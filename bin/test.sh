#!/bin/bash

cur=$1
prev=kp
COMP_LINE="ws mariadb:delete-backup $prev $1"




COMPREPLY=$(compgen -W "${OPTIONS}" -- "$cur" | sed "/\n/g")

mapfile -t COMPREPLY <<< "$COMPREPLY"

#declare -p COMPREPLY

#echo -e "${COMPREPLY[@]}"

echo "Size: ${#COMPREPLY[*]}"

for i in "${COMPREPLY[@]}"; do
    echo $"Option: $i"
done

#COMP_LINE="ws mariadb:delete-backup kp kp\\ 20"
COMP_LINE="ws \"test 1\" test\\ 2 \"test 3"

for i in "${ARGS[@]}"; do
  echo "Arg: $i"
done
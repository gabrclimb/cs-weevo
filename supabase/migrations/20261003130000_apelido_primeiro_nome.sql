-- O apelido passa a ser, por padrão, o primeiro nome. Preenche só quem está sem apelido; não altera apelidos já definidos.
update public.weevo_participantes
set apelido = split_part(btrim(nome), ' ', 1)
where (apelido is null or btrim(apelido) = '')
  and btrim(nome) <> '';
